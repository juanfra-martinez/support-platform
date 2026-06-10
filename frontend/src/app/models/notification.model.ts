export enum NotificationType {
  TICKET_CREATED = 'TICKET_CREATED',
  TICKET_UPDATED = 'TICKET_UPDATED',
  TICKET_ASSIGNED = 'TICKET_ASSIGNED',
  TICKET_CLOSED = 'TICKET_CLOSED',
  COMMENT_ADDED = 'COMMENT_ADDED',
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  ticketId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
