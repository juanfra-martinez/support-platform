import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Role, TicketPriority, TicketStatus } from '@prisma/client';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import configuration from '../src/config/configuration';
import { RoutingKeys } from '../src/messaging/contracts/routing-keys';
import { EventPublisherService } from '../src/messaging/event-publisher.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TicketsController } from '../src/tickets/tickets.controller';
import { TicketsService } from '../src/tickets/tickets.service';
import { applyGlobals, setTestEnv } from './utils/test-app.util';
import { createPrismaMock, PrismaMock } from './utils/prisma-mock';

describe('Ticket creation flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  let events: { enqueue: jest.Mock };
  let token: string;

  const actor = {
    id: 'cust-1',
    email: 'customer@acme.test',
    role: Role.CUSTOMER,
    organizationId: 'org-1',
    isActive: true,
  };

  beforeAll(async () => {
    setTestEnv();
    prisma = createPrismaMock();
    events = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [configuration],
        }),
        PrismaModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [TicketsController],
      providers: [
        TicketsService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        { provide: EventPublisherService, useValue: events },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    applyGlobals(app);
    await app.init();

    // Mint a real access token; the JWT strategy will rehydrate the user.
    const jwt = app.get(JwtService);
    const config = app.get(ConfigService);
    token = await jwt.signAsync(
      {
        sub: actor.id,
        email: actor.email,
        role: actor.role,
        organizationId: actor.organizationId,
      },
      {
        secret: config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: '15m',
      },
    );
    prisma.user.findUnique.mockResolvedValue(actor);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects ticket creation without authentication (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/tickets')
      .send({ title: 'Cannot log in', description: 'It fails' });

    expect(res.status).toBe(401);
  });

  it('rejects an invalid ticket body (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x' }); // too short, description missing

    expect(res.status).toBe(400);
  });

  it('creates a ticket atomically and enqueues ticket.created', async () => {
    const created = {
      id: 'tkt-1',
      reference: 'TKT-000001',
      title: 'Cannot log in',
      description: '500 on login after release',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      category: null,
      organizationId: actor.organizationId,
      createdById: actor.id,
      assignedToId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    };
    const tx = {
      ticket: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    prisma.$transaction.mockImplementation(
      (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const res = await request(app.getHttpServer())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Cannot log in',
        description: '500 on login after release',
        priority: TicketPriority.HIGH,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.reference).toBe('TKT-000001');

    // The domain event is enqueued in the SAME transaction (outbox pattern).
    expect(events.enqueue).toHaveBeenCalledWith(
      tx,
      RoutingKeys.TicketCreated,
      expect.objectContaining({ ticketId: 'tkt-1', reference: 'TKT-000001' }),
      undefined,
    );
  });
});
