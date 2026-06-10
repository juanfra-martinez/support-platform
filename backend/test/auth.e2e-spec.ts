import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import configuration from '../src/config/configuration';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyGlobals, setTestEnv } from './utils/test-app.util';
import { createPrismaMock, PrismaMock } from './utils/prisma-mock';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  const password = 'Password123!';

  const user = {
    id: 'user-1',
    email: 'admin@acme.test',
    firstName: 'Ada',
    lastName: 'Admin',
    role: Role.ADMIN,
    organizationId: 'org-1',
    isActive: true,
    passwordHash: '',
  };

  beforeAll(async () => {
    setTestEnv();
    user.passwordHash = await bcrypt.hash(password, 4);
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [configuration],
        }),
        PrismaModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    applyGlobals(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects registration with an invalid body (400) in the error envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('logs in with valid credentials and returns a token pair', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('rejects bad credentials with 401', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects /auth/me without a token (401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the profile for an authenticated request', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password });
    const token = login.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.role).toBe(Role.ADMIN);
  });
});
