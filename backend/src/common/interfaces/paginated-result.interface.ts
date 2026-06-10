export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Returned by services for any list endpoint. The ResponseInterceptor detects
 * this shape and hoists `meta` to the top level of the HTTP envelope.
 */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
