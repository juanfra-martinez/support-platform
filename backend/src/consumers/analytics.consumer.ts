import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DomainEvent,
  TicketAssignedPayload,
  TicketClosedPayload,
  TicketCreatedPayload,
} from '../messaging/contracts/event-payloads';
import { RoutingKeys } from '../messaging/contracts/routing-keys';
import {
  AnalyticsBindings,
  Consumers,
  EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  Queues,
} from '../messaging/contracts/topology';
import { ConsumerRunner, RawAmqpMessage } from './consumer-runner.service';

type MetricField = 'ticketsCreated' | 'ticketsAssigned' | 'ticketsClosed';

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Analytics Consumer — maintains a daily per-organization metrics rollup.
 * Independent of notifications/audit; owns only analytics.queue and reacts to
 * the lifecycle events that move the numbers.
 */
@Injectable()
export class AnalyticsConsumer {
  constructor(private readonly runner: ConsumerRunner) {}

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: AnalyticsBindings,
    queue: Queues.Analytics,
    queueOptions: {
      durable: true,
      deadLetterExchange: DEAD_LETTER_EXCHANGE,
    },
  })
  async onEvent(event: DomainEvent<unknown>, raw: RawAmqpMessage): Promise<void> {
    await this.runner.handle(
      Consumers.Analytics,
      Queues.Analytics,
      event,
      raw,
      (tx, e) => this.project(tx, e),
    );
  }

  private async project(
    tx: Prisma.TransactionClient,
    event: DomainEvent<unknown>,
  ): Promise<void> {
    let organizationId: string;
    let field: MetricField;

    switch (event.routingKey) {
      case RoutingKeys.TicketCreated:
        organizationId = (event.payload as TicketCreatedPayload).organizationId;
        field = 'ticketsCreated';
        break;
      case RoutingKeys.TicketAssigned:
        organizationId = (event.payload as TicketAssignedPayload).organizationId;
        field = 'ticketsAssigned';
        break;
      case RoutingKeys.TicketClosed:
        organizationId = (event.payload as TicketClosedPayload).organizationId;
        field = 'ticketsClosed';
        break;
      default:
        return;
    }

    const date = startOfUtcDay();

    const update: Prisma.TicketMetricDailyUpdateInput = {
      ticketsCreated:
        field === 'ticketsCreated' ? { increment: 1 } : undefined,
      ticketsAssigned:
        field === 'ticketsAssigned' ? { increment: 1 } : undefined,
      ticketsClosed: field === 'ticketsClosed' ? { increment: 1 } : undefined,
    };

    await tx.ticketMetricDaily.upsert({
      where: { organizationId_date: { organizationId, date } },
      create: {
        organizationId,
        date,
        ticketsCreated: field === 'ticketsCreated' ? 1 : 0,
        ticketsAssigned: field === 'ticketsAssigned' ? 1 : 0,
        ticketsClosed: field === 'ticketsClosed' ? 1 : 0,
      },
      update,
    });
  }
}
