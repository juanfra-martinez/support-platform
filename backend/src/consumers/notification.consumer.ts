import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
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
  Consumers,
  EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  NotificationBindings,
  Queues,
} from '../messaging/contracts/topology';
import { PrismaService } from '../prisma/prisma.service';
import { ConsumerRunner, RawAmqpMessage } from './consumer-runner.service';

function unique(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => !!id))];
}

function describeChanges(changes: TicketUpdatedPayload['changes']): string {
  return Object.entries(changes)
    .map(([key, value]) => `${key} → ${String(value)}`)
    .join(', ');
}

/**
 * Notification Consumer — turns domain events into per-user notification rows.
 * Independent of the audit and analytics consumers; owns only notification.queue.
 */
@Injectable()
export class NotificationConsumer {
  constructor(
    private readonly runner: ConsumerRunner,
    private readonly prisma: PrismaService,
  ) {}

  @RabbitSubscribe({
    exchange: EXCHANGE,
    routingKey: NotificationBindings,
    queue: Queues.Notification,
    queueOptions: {
      durable: true,
      deadLetterExchange: DEAD_LETTER_EXCHANGE,
    },
  })
  async onEvent(event: DomainEvent<unknown>, raw: RawAmqpMessage): Promise<void> {
    await this.runner.handle(
      Consumers.Notification,
      Queues.Notification,
      event,
      raw,
      (tx, e) => this.project(tx, e),
    );
  }

  private async project(
    tx: Prisma.TransactionClient,
    event: DomainEvent<unknown>,
  ): Promise<void> {
    switch (event.routingKey) {
      case RoutingKeys.TicketCreated: {
        const p = event.payload as TicketCreatedPayload;
        await this.notify(
          tx,
          unique([p.createdById, p.assignedToId]),
          NotificationType.TICKET_CREATED,
          'Ticket created',
          `Ticket ${p.reference} — "${p.title}" was created.`,
          p.ticketId,
        );
        break;
      }
      case RoutingKeys.TicketAssigned: {
        const p = event.payload as TicketAssignedPayload;
        await this.notify(
          tx,
          unique([p.assignedToId]).filter((id) => id !== p.assignedById),
          NotificationType.TICKET_ASSIGNED,
          'Ticket assigned to you',
          `Ticket ${p.reference} was assigned to you.`,
          p.ticketId,
        );
        break;
      }
      case RoutingKeys.TicketUpdated: {
        const p = event.payload as TicketUpdatedPayload;
        const ticket = await tx.ticket.findUnique({
          where: { id: p.ticketId },
          select: { createdById: true, assignedToId: true },
        });
        if (!ticket) {
          break;
        }
        const summary = describeChanges(p.changes);
        await this.notify(
          tx,
          unique([ticket.createdById, ticket.assignedToId]).filter(
            (id) => id !== p.updatedById,
          ),
          NotificationType.TICKET_UPDATED,
          'Ticket updated',
          `Ticket ${p.reference} was updated${summary ? `: ${summary}` : ''}.`,
          p.ticketId,
        );
        break;
      }
      case RoutingKeys.TicketClosed: {
        const p = event.payload as TicketClosedPayload;
        const ticket = await tx.ticket.findUnique({
          where: { id: p.ticketId },
          select: { createdById: true, assignedToId: true },
        });
        if (!ticket) {
          break;
        }
        await this.notify(
          tx,
          unique([ticket.createdById, ticket.assignedToId]).filter(
            (id) => id !== p.closedById,
          ),
          NotificationType.TICKET_CLOSED,
          'Ticket closed',
          `Ticket ${p.reference} has been closed.`,
          p.ticketId,
        );
        break;
      }
      case RoutingKeys.CommentCreated: {
        const p = event.payload as CommentCreatedPayload;
        const ticket = await tx.ticket.findUnique({
          where: { id: p.ticketId },
          select: { reference: true, createdById: true, assignedToId: true },
        });
        if (!ticket) {
          break;
        }
        // Internal notes stay between staff; public comments also reach the
        // customer who opened the ticket.
        const candidates = p.isInternal
          ? [ticket.assignedToId]
          : [ticket.createdById, ticket.assignedToId];
        await this.notify(
          tx,
          unique(candidates).filter((id) => id !== p.authorId),
          NotificationType.COMMENT_ADDED,
          'New comment',
          `A new comment was added to ticket ${ticket.reference}.`,
          p.ticketId,
        );
        break;
      }
      default:
        break;
    }
  }

  private async notify(
    tx: Prisma.TransactionClient,
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    ticketId: string,
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    await tx.notification.createMany({
      data: userIds.map((userId) => ({ userId, type, title, message, ticketId })),
    });
  }
}
