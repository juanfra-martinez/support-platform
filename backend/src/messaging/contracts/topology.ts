import { RoutingKeys } from './routing-keys';

/**
 * RabbitMQ topology shared by producer and consumers.
 *
 *   support.events (topic)                  -- domain events
 *     ├─ notification.queue                 -- user-facing notifications
 *     ├─ audit.queue                        -- immutable audit trail (binds '#')
 *     └─ analytics.queue                    -- daily ticket metrics
 *   support.events.dlx (topic)              -- dead letters
 *     └─ dlq                                -- terminal sink (binds '#')
 *
 * Each consumer queue is configured to dead-letter to the DLX. Transient
 * failures are retried a bounded number of times (see ConsumerRunner) before a
 * message is routed to the DLX/dlq for inspection.
 */
export const EXCHANGE = 'support.events';
export const DEAD_LETTER_EXCHANGE = 'support.events.dlx';

export const Queues = {
  Notification: 'notification.queue',
  Audit: 'audit.queue',
  Analytics: 'analytics.queue',
  DeadLetter: 'dlq',
} as const;

/** Logical consumer names — used as the idempotency partition key. */
export const Consumers = {
  Notification: 'notification',
  Audit: 'audit',
  Analytics: 'analytics',
} as const;

/** Routing-key bindings per queue. */
export const NotificationBindings: string[] = [
  RoutingKeys.TicketCreated,
  RoutingKeys.TicketUpdated,
  RoutingKeys.TicketAssigned,
  RoutingKeys.TicketClosed,
  RoutingKeys.CommentCreated,
];

export const AuditBindings: string[] = ['#'];

export const AnalyticsBindings: string[] = [
  RoutingKeys.TicketCreated,
  RoutingKeys.TicketAssigned,
  RoutingKeys.TicketClosed,
];

export const DeadLetterBindings: string[] = ['#'];

/** Header used to carry the bounded-retry counter on requeued messages. */
export const RETRY_HEADER = 'x-retry';
export const LAST_ERROR_HEADER = 'x-last-error';
