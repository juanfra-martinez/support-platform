import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, TicketPriority, TicketStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RoutingKeys } from '../../messaging/contracts/routing-keys';
import { EventPublisherService } from '../../messaging/event-publisher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketsService } from '../tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: {
    ticket: {
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    user: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let events: { enqueue: jest.Mock };

  const customer: AuthenticatedUser = {
    id: 'user-customer',
    email: 'customer@acme.test',
    role: Role.CUSTOMER,
    organizationId: 'org-1',
  };
  const agent: AuthenticatedUser = {
    id: 'user-agent',
    email: 'agent@acme.test',
    role: Role.AGENT,
    organizationId: 'org-1',
  };

  beforeEach(async () => {
    prisma = {
      ticket: {
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      user: { findFirst: jest.fn() },
      // Support both the array form and the interactive-callback form.
      $transaction: jest.fn((arg) =>
        typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
      ),
    };
    events = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventPublisherService, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(TicketsService);
  });

  describe('create', () => {
    it('creates a ticket with a generated reference and enqueues ticket.created', async () => {
      prisma.ticket.count.mockResolvedValue(41);
      const created = {
        id: 'ticket-1',
        reference: 'TKT-000042',
        title: 'Help',
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
        organizationId: 'org-1',
        createdById: customer.id,
        assignedToId: null,
      };
      prisma.ticket.create.mockResolvedValue(created);

      const result = await service.create(
        customer,
        { title: 'Help', description: 'It is broken' },
        'corr-123',
      );

      expect(result.reference).toBe('TKT-000042');
      expect(prisma.ticket.create).toHaveBeenCalledTimes(1);
      expect(events.enqueue).toHaveBeenCalledWith(
        prisma,
        RoutingKeys.TicketCreated,
        expect.objectContaining({ ticketId: 'ticket-1', reference: 'TKT-000042' }),
        'corr-123',
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the ticket does not exist in the org', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);
      await expect(service.findOne(agent, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('forbids a customer from reading a ticket they did not create', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: 'ticket-9',
        organizationId: 'org-1',
        createdById: 'someone-else',
      });
      await expect(service.findOne(customer, 'ticket-9')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('prevents customers from changing status', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        organizationId: 'org-1',
        createdById: customer.id,
        status: TicketStatus.OPEN,
      });

      await expect(
        service.update(customer, 'ticket-1', { status: TicketStatus.CLOSED }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('emits ticket.closed when an agent closes a ticket', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        organizationId: 'org-1',
        createdById: customer.id,
        status: TicketStatus.OPEN,
      });
      prisma.ticket.update.mockResolvedValue({
        id: 'ticket-1',
        reference: 'TKT-000001',
        organizationId: 'org-1',
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
      });

      await service.update(agent, 'ticket-1', { status: TicketStatus.CLOSED });

      const routingKeys = events.enqueue.mock.calls.map((c) => c[1]);
      expect(routingKeys).toContain(RoutingKeys.TicketUpdated);
      expect(routingKeys).toContain(RoutingKeys.TicketClosed);
    });
  });

  describe('assign', () => {
    it('rejects an assignee who is not an active agent/admin', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        organizationId: 'org-1',
        createdById: customer.id,
      });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.assign(agent, 'ticket-1', { assigneeId: 'nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
