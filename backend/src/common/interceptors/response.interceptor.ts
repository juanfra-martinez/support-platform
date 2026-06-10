import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginationMeta } from '../interfaces/paginated-result.interface';

export interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

function isPaginated(
  value: unknown,
): value is { items: unknown[]; meta: PaginationMeta } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    'meta' in value
  );
}

/**
 * Wraps every successful response in a consistent envelope:
 *   - single resource -> { data }
 *   - paginated list   -> { data: items, meta }
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<unknown>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<unknown>> {
    return next.handle().pipe(
      map((payload): ApiEnvelope<unknown> => {
        if (isPaginated(payload)) {
          return { data: payload.items, meta: payload.meta };
        }
        return { data: payload };
      }),
    );
  }
}
