import { NotificationType } from '@prisma/client';
import {
  CommentCreatedPayload,
  DomainEvent,
  TicketCreatedPayload,
} from '../../messaging/contracts/event-payloads';
import { RoutingKeys } from '../../messaging/contracts/routing-keys';
import { ConsumerRunner } from '../consumer-runner.service';
import { NotificationConsumer } from '../notification.consumer';

/**
 * A stub runner that invokes the projector directly with a fake transaction
 * client, so we can assert the projection logic without a broker or database.
 */
function stubRunner(tx: unknown): ConsumerRunner {
  const runner: Pick<ConsumerRunner, 'handle'> = {
    handle: (_consumer, _queue, event, _raw, project) =>
      project(tx as never, event),
  };
  return runner as ConsumerRunner;
}

describe('NotificationConsumer', () => {
  it('notifies the creator (and assignee) when a ticket is created', async () => {
    const tx = { notification: { createMany: jest.fn() }, ticket: { findUnique: jest.fn() } };
    const consumer = new NotificationConsumer(stubRunner(tx), {} as never);

    const payload: TicketCreatedPayload = {
      ticketId: 'tkt-1',
      reference: 'TKT-000001',
      title: 'Cannot log in',
      status: 'OPEN',
      priority: 'HIGH',
      organizationId: 'org-1',
      createdById: 'cust-1',
      assignedToId: null,
    };
    const event: DomainEvent<unknown> = {
      eventId: 'e1',
      routingKey: RoutingKeys.TicketCreated,
      occurredAt: new Date().toISOString(),
      payload,
    };

    await consumer.onEvent(event, { properties: {} });

    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    const arg = tx.notification.createMany.mock.calls[0][0];
    expect(arg.data).toEqual([
      {
        userId: 'cust-1',
        type: NotificationType.TICKET_CREATED,
        title: 'Ticket created',
        message: expect.stringContaining('TKT-000001'),
        ticketId: 'tkt-1',
      },
    ]);
  });

  it('excludes the comment author and notifies the other participant', async () => {
    const tx = {
      ticket: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            reference: 'TKT-000002',
            createdById: 'cust-1',
            assignedToId: 'agent-1',
          }),
      },
      notification: { createMany: jest.fn() },
    };
    const consumer = new NotificationConsumer(stubRunner(tx), {} as never);

    const payload: CommentCreatedPayload = {
      commentId: 'cmt-1',
      ticketId: 'tkt-2',
      organizationId: 'org-1',
      authorId: 'agent-1', // the agent commented
      isInternal: false,
    };
    const event: DomainEvent<unknown> = {
      eventId: 'e2',
      routingKey: RoutingKeys.CommentCreated,
      occurredAt: new Date().toISOString(),
      payload,
    };

    await consumer.onEvent(event, { properties: {} });

    const arg = tx.notification.createMany.mock.calls[0][0];
    expect(arg.data).toHaveLength(1);
    expect(arg.data[0].userId).toBe('cust-1'); // author (agent) excluded
    expect(arg.data[0].type).toBe(NotificationType.COMMENT_ADDED);
  });

  it('creates no notifications when there is no eligible recipient', async () => {
    const tx = {
      ticket: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            reference: 'TKT-000003',
            createdById: 'cust-1',
            assignedToId: null,
          }),
      },
      notification: { createMany: jest.fn() },
    };
    const consumer = new NotificationConsumer(stubRunner(tx), {} as never);

    // Internal note with no assignee -> nobody to notify.
    const payload: CommentCreatedPayload = {
      commentId: 'cmt-2',
      ticketId: 'tkt-3',
      organizationId: 'org-1',
      authorId: 'cust-1',
      isInternal: true,
    };
    await consumer.onEvent(
      {
        eventId: 'e3',
        routingKey: RoutingKeys.CommentCreated,
        occurredAt: new Date().toISOString(),
        payload,
      },
      { properties: {} },
    );

    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
});
