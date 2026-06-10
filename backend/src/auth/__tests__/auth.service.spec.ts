import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { TokenService } from '../token.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    organization: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let tokenService: { issueTokens: jest.Mock; rotate: jest.Mock; revoke: jest.Mock };

  const tokens = {
    accessToken: 'access',
    refreshToken: 'refresh',
    tokenType: 'Bearer' as const,
    expiresIn: '15m',
  };

  beforeEach(async () => {
    prisma = {
      organization: { findUnique: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    tokenService = {
      issueTokens: jest.fn().mockResolvedValue(tokens),
      rotate: jest.fn().mockResolvedValue(tokens),
      revoke: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokenService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue(12) },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('rejects when the organization is missing', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(
        service.register(
          {
            email: 'a@b.test',
            password: 'Password123!',
            firstName: 'A',
            lastName: 'B',
            organizationId: 'org-x',
          },
          {},
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a duplicate email', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        isActive: true,
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register(
          {
            email: 'dup@b.test',
            password: 'Password123!',
            firstName: 'A',
            lastName: 'B',
            organizationId: 'org-1',
          },
          {},
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a CUSTOMER and returns tokens', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        isActive: true,
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@b.test',
        firstName: 'A',
        lastName: 'B',
        role: Role.CUSTOMER,
        organizationId: 'org-1',
      });

      const result = await service.register(
        {
          email: 'new@b.test',
          password: 'Password123!',
          firstName: 'A',
          lastName: 'B',
          organizationId: 'org-1',
        },
        {},
      );

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.user.role).toBe(Role.CUSTOMER);
      expect(result.accessToken).toBe('access');
    });
  });

  describe('login', () => {
    it('rejects invalid credentials without leaking which field failed', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.test',
        passwordHash: await bcrypt.hash('correct', 4),
        isActive: true,
      });

      await expect(
        service.login({ email: 'a@b.test', password: 'wrong' }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
