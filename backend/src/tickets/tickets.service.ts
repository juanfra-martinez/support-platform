import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, Ticket, TicketStatus } from '@prisma/client';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  buildPaginatedResult,
  toPrismaOrderBy,
  toPrismaPage,
} from '../common/utils/pagination.util';
import { EventPublisherService } from '../messaging/event-publisher.service';
import { RoutingKeys } from '../messaging/contracts/routing-keys';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

const SORTABLE = [
  'createdAt',
  'updatedAt',
  'priority',
  'status',
  'reference',
] as const;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisherService,
  ) {}

  /**
   * Generates the next human-friendly reference within a transaction. Counting
   * within the same tx keeps the value consistent under the created row.
   */
  private async nextReference(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const count = await tx.ticket.count();
    return `TKT-${String(count + 1).padStart(6, '0')}`;
  }

  async create(
    actor: AuthenticatedUser,
    dto: CreateTicketDto,
    correlationId?: string,
  ): Promise<Ticket> {
    return this.prisma.$transaction(async (tx) => {
      const reference = await this.nextReference(tx);
      const ticket = await tx.ticket.create({
        data: {
          reference,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          category: dto.category,
          organizationId: actor.organizationId,
          createdById: actor.id,
        },
      });

      await this.events.enqueue(
        tx,
        RoutingKeys.TicketCreated,
        {
          ticketId: ticket.id,
          reference: ticket.reference,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          organizationId: ticket.organizationId,
          createdById: ticket.createdById,
          assignedToId: ticket.assignedToId,
        },
        correlationId,
      );

      return ticket;
    });
  }

  async findAll(
    actor: AuthenticatedUser,
    query: TicketQueryDto,
  ): Promise<PaginatedResult<Ticket>> {
    const where: Prisma.TicketWhereInput = {
      organizationId: actor.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Customers only ever see their own tickets.
    if (actor.role === Role.CUSTOMER) {
      where.createdById = actor.id;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        orderBy: toPrismaOrderBy(query.sort, SORTABLE),
        ...toPrismaPage(query),
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (actor.role === Role.CUSTOMER && ticket.createdById !== actor.id) {
      throw new ForbiddenException('You cannot access this ticket');
    }
    return ticket;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateTicketDto,
    correlationId?: string,
  ): Promise<Ticket> {
    const existing = await this.findOne(actor, id);

    // Customers may only edit content of their own OPEN tickets, never status.
    if (actor.role === Role.CUSTOMER) {
      if (dto.status || dto.priority) {
        throw new ForbiddenException(
          'Customers cannot change status or priority',
        );
      }
    }

    const willClose =
      dto.status === TicketStatus.CLOSED &&
      existing.status !== TicketStatus.CLOSED;

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id },
        data: {
          ...dto,
          ...(willClose ? { closedAt: new Date() } : {}),
        },
      });

      await this.events.enqueue(
        tx,
        RoutingKeys.TicketUpdated,
        {
          ticketId: ticket.id,
          reference: ticket.reference,
          organizationId: ticket.organizationId,
          changes: dto,
          updatedById: actor.id,
        },
        correlationId,
      );

      if (willClose) {
        await this.events.enqueue(
          tx,
          RoutingKeys.TicketClosed,
          {
            ticketId: ticket.id,
            reference: ticket.reference,
            organizationId: ticket.organizationId,
            closedById: actor.id,
            closedAt: (ticket.closedAt ?? new Date()).toISOString(),
          },
          correlationId,
        );
      }

      return ticket;
    });
  }

  async assign(
    actor: AuthenticatedUser,
    id: string,
    dto: AssignTicketDto,
    correlationId?: string,
  ): Promise<Ticket> {
    await this.findOne(actor, id);

    const assignee = await this.prisma.user.findFirst({
      where: {
        id: dto.assigneeId,
        organizationId: actor.organizationId,
        isActive: true,
        role: { in: [Role.AGENT, Role.ADMIN] },
      },
    });
    if (!assignee) {
      throw new NotFoundException('Assignee must be an active agent or admin');
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id },
        data: {
          assignedToId: dto.assigneeId,
          status: TicketStatus.IN_PROGRESS,
        },
      });

      await this.events.enqueue(
        tx,
        RoutingKeys.TicketAssigned,
        {
          ticketId: ticket.id,
          reference: ticket.reference,
          organizationId: ticket.organizationId,
          assignedToId: dto.assigneeId,
          assignedById: actor.id,
        },
        correlationId,
      );

      return ticket;
    });
  }
}
