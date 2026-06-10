import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import {
  buildPaginatedResult,
  toPrismaPage,
} from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';

/**
 * Read model over the `audit_logs` projection. Entries are written by the audit
 * consumer (worker, Phase 3); admins query them here, always scoped to their
 * own organization.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    query: AuditQueryDto,
  ): Promise<PaginatedResult<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toPrismaPage(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query);
  }
}
