/** Standard success envelope returned by the API. */
export interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Convenience shape after unwrapping a paginated envelope. */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Standard error envelope returned by the API exception filter. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  correlationId?: string;
  timestamp: string;
}
