import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import {
  buildPaginatedResult,
  toPrismaOrderBy,
  toPrismaPage,
} from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

const SORTABLE = ['firstName', 'lastName', 'email', 'createdAt'] as const;

/** Prisma selection that excludes the password hash from every response. */
const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  organizationId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.getOrThrow<number>('security.bcryptSaltRounds'),
    );

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        organizationId: dto.organizationId,
      },
      select: userSelect,
    });
  }

  async findAll(
    organizationId: string,
    query: UserQueryDto,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {
      organizationId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: toPrismaOrderBy(query.sort, SORTABLE),
        ...toPrismaPage(query),
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query);
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    await this.findOne(organizationId, id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: userSelect,
    });
  }

  async deactivate(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
