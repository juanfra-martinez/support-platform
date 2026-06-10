import { TicketPriority, TicketStatus } from '@prisma/client';

/**
 * Versioned event envelope carried on the wire. `eventId` equals the
 * EventOutbox row id and is used by consumers for idempotency.
 */
export interface DomainEvent<TPayload> {
  eventId: string;
  routingKey: string;
  occurredAt: string;
  correlationId?: string;
  payload: TPayload;
}

export interface TicketCreatedPayload {
  ticketId: string;
  reference: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  organizationId: string;
  createdById: string;
  assignedToId: string | null;
}

export interface TicketUpdatedPayload {
  ticketId: string;
  reference: string;
  organizationId: string;
  changes: Partial<{
    status: TicketStatus;
    priority: TicketPriority;
    title: string;
    category: string | null;
  }>;
  updatedById: string;
}

export interface TicketAssignedPayload {
  ticketId: string;
  reference: string;
  organizationId: string;
  assignedToId: string;
  assignedById: string;
}

export interface TicketClosedPayload {
  ticketId: string;
  reference: string;
  organizationId: string;
  closedById: string;
  closedAt: string;
}

export interface CommentCreatedPayload {
  commentId: string;
  ticketId: string;
  organizationId: string;
  authorId: string;
  isInternal: boolean;
}
