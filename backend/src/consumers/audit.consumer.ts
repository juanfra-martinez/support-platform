import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CommentCreatedPayload,
  DomainEvent,
  TicketAssignedPayload,
  TicketClosedPayload,
  TicketCreatedPayload,
  TicketUpdatedPayload,
} from '../messaging/contracts/event-payloads';
import { RoutingKeys } from '../messaging/contracts/routing-keys';
import {
  AuditBindings,
  Consumers,
  EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  Queues,
} from '../messaging/contracts/topology';
import { ConsumerRunner, RawAmqpMessage } from './consumer-runner.service';

interface AuditDescriptor {
  entityType: string;
  entityId: string;
  actorId: string | null;
  organizationId: string | null;
}

/**
 * Audit Consumer — writes an immutable audit-trail row for every domain event.
 * Binds the wildcard '#', so it records the full activity stream regardless of
 * which other consumers care about a given event.
 */
@Injectable()
export class AuditConsumer {
  constructor(private readonly runner: ConsumerRunner) {}

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: AuditBindings,
    queue: Queues.Audit,
    queueOptions: {
      durable: true,
      deadLetterExchange: DEAD_LETTER_EXCHANGE,
    },
  })
  async onEvent(event: DomainEvent<unknown>, raw: RawAmqpMessage): Promise<void> {
    await this.runner.handle(
      Consumers.Audit,
      Queues.Audit,
      event,
      raw,
      (tx, e) => this.project(tx, e),
    );
  }

  private async project(
    tx: Prisma.TransactionClient,
    event: DomainEvent<unknown>,
  ): Promise<void> {
    const descriptor = this.describe(event);
    await tx.auditLog.create({
      data: {
        action: event.routingKey,
        entityType: descriptor.entityType,
        entityId: descriptor.entityId,
        actorId: descriptor.actorId,
        organizationId: descriptor.organizationId,
        correlationId: event.correlationId ?? null,
        metadata: event.payload as Prisma.InputJsonValue,
      },
    });
  }

  private describe(event: DomainEvent<unknown>): AuditDescriptor {
    switch (event.routingKey) {
      case RoutingKeys.TicketCreated: {
        const p = event.payload as TicketCreatedPayload;
        return {
          entityType: 'Ticket',
          entityId: p.ticketId,
          actorId: p.createdById,
          organizationId: p.organizationId,
        };
      }
      case RoutingKeys.TicketUpdated: {
        const p = event.payload as TicketUpdatedPayload;
        return {
          entityType: 'Ticket',
          entityId: p.ticketId,
          actorId: p.updatedById,
          organizationId: p.organizationId,
        };
      }
      case RoutingKeys.TicketAssigned: {
        const p = event.payload as TicketAssignedPayload;
        return {
          entityType: 'Ticket',
          entityId: p.ticketId,
          actorId: p.assignedById,
          organizationId: p.organizationId,
        };
      }
      case RoutingKeys.TicketClosed: {
        const p = event.payload as TicketClosedPayload;
        return {
          entityType: 'Ticket',
          entityId: p.ticketId,
          actorId: p.closedById,
          organizationId: p.organizationId,
        };
      }
      case RoutingKeys.CommentCreated: {
        const p = event.payload as CommentCreatedPayload;
        return {
          entityType: 'Comment',
          entityId: p.commentId,
          actorId: p.authorId,
          organizationId: p.organizationId,
        };
      }
      default:
        return {
          entityType: 'Unknown',
          entityId: event.eventId,
          actorId: null,
          organizationId: null,
        };
    }
  }
}
