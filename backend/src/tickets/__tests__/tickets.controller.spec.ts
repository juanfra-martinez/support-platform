import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TicketsController } from '../tickets.controller';
import { TicketsService } from '../tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    assign: jest.Mock;
  };

  const user: AuthenticatedUser = {
    id: 'user-agent',
    email: 'agent@acme.test',
    role: Role.AGENT,
    organizationId: 'org-1',
  };
  const req = { correlationId: 'corr-abc' } as unknown as Request;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
      findAll: jest.fn().mockResolvedValue({ items: [], meta: {} }),
      findOne: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
      update: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
      assign: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(TicketsController);
  });

  it('passes the correlation id through to the service on create', async () => {
    await controller.create(user, { title: 'A title', description: 'A body' }, req);
    expect(service.create).toHaveBeenCalledWith(
      user,
      { title: 'A title', description: 'A body' },
      'corr-abc',
    );
  });

  it('delegates assign to the service', async () => {
    await controller.assign(user, 'ticket-1', { assigneeId: 'user-x' }, req);
    expect(service.assign).toHaveBeenCalledWith(
      user,
      'ticket-1',
      { assigneeId: 'user-x' },
      'corr-abc',
    );
  });
});
