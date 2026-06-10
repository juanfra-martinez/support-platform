import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Ensures every request carries a correlation id (generating one if absent),
 * exposes it on the response header and logs request timing. The id is read
 * downstream by the exception filter and propagated to published events.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const correlationId =
      (request.headers[CORRELATION_ID_HEADER] as string) ?? randomUUID();
    (request as Request & { correlationId: string }).correlationId =
      correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    const start = Date.now();
    const { method, originalUrl } = request;

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(
          `${method} ${originalUrl} ${response.statusCode} +${ms}ms [${correlationId}]`,
        );
      }),
    );
  }
}
