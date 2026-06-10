import { PaginationQueryDto, SortDirection } from '../dto/pagination-query.dto';
import {
  PaginatedResult,
  PaginationMeta,
} from '../interfaces/paginated-result.interface';

/**
 * Reusable pagination/sorting helpers shared by every list endpoint.
 */
export interface PrismaPageArgs {
  skip: number;
  take: number;
}

export function toPrismaPage(query: PaginationQueryDto): PrismaPageArgs {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { skip: (page - 1) * limit, take: limit };
}

/**
 * Parses a "field:direction" sort expression into a Prisma orderBy object,
 * guarding against arbitrary fields via an allow-list.
 */
export function toPrismaOrderBy(
  sort: string | undefined,
  allowedFields: readonly string[],
  fallback: Record<string, SortDirection> = { createdAt: 'desc' },
): Record<string, SortDirection> {
  if (!sort) {
    return fallback;
  }
  const [field, rawDirection] = sort.split(':');
  if (!allowedFields.includes(field)) {
    return fallback;
  }
  const direction: SortDirection = rawDirection === 'asc' ? 'asc' : 'desc';
  return { [field]: direction };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  query: PaginationQueryDto,
): PaginatedResult<T> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
  return { items, meta };
}
