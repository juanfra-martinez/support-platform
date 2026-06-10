/**
 * Single source of truth for RabbitMQ routing keys on the `support.events`
 * topic exchange. Producers and (future) consumers both import from here so a
 * typo can never silently break a binding.
 */
export const RoutingKeys = {
  TicketCreated: 'ticket.created',
  TicketUpdated: 'ticket.updated',
  TicketAssigned: 'ticket.assigned',
  TicketClosed: 'ticket.closed',
  CommentCreated: 'comment.created',
  NotificationCreated: 'notification.created',
} as const;

export type RoutingKey = (typeof RoutingKeys)[keyof typeof RoutingKeys];
