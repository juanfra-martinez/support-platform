import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccessTokenPayload,
  AuthTokens,
  RefreshTokenPayload,
} from './interfaces/jwt-payload.interface';

/**
 * Issues and rotates JWTs.
 *
 * - Access tokens are short-lived and stateless.
 * - Refresh tokens are JWTs whose SHA-256 hash is persisted (never the raw
 *   token). Each refresh rotates the token within a "family"; presenting an
 *   already-revoked token triggers reuse detection and revokes the whole
 *   family (logout-everywhere defence against token theft).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiryToDate(expiresIn: string): Date {
    // Supports "<n>d" / "<n>h" / "<n>m" / "<n>s"; defaults to 7 days.
    const match = /^(\d+)([dhms])$/.exec(expiresIn);
    const now = Date.now();
    if (!match) {
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    }
    const value = parseInt(match[1], 10);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(now + value * unitMs[match[2]]);
  }

  async issueTokens(
    user: Pick<User, 'id' | 'email' | 'role' | 'organizationId'>,
    context?: { userAgent?: string; ipAddress?: string },
    familyId: string = randomUUID(),
  ): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessExpiresIn = this.config.getOrThrow<string>(
      'jwt.accessExpiresIn',
    );
    const refreshExpiresIn = this.config.getOrThrow<string>(
      'jwt.refreshExpiresIn',
    );

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
    });

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti,
      familyId,
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
    });

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        familyId,
        expiresAt: this.expiryToDate(refreshExpiresIn),
        userAgent: context?.userAgent ?? null,
        ipAddress: context?.ipAddress ?? null,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
    };
  }

  async rotate(
    rawRefreshToken: string,
    context?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        rawRefreshToken,
        { secret: this.config.getOrThrow<string>('jwt.refreshSecret') },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!stored || stored.tokenHash !== this.hash(rawRefreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: a revoked token presented again means the family is
    // compromised -> revoke every token in the family.
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is no longer active');
    }

    // Revoke the presented token and issue a new one in the same family.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user, context, stored.familyId);
  }

  async revoke(rawRefreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        rawRefreshToken,
        { secret: this.config.getOrThrow<string>('jwt.refreshSecret') },
      );
    } catch {
      return; // Nothing to revoke for an invalid token.
    }
    await this.prisma.refreshToken.updateMany({
      where: { familyId: payload.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
