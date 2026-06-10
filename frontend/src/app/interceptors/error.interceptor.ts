import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '@app/models/api-response.model';
import { UiNotificationService } from '@app/services/ui-notification.service';

function extractMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  const body = error.error as ApiError | undefined;
  if (body?.message) {
    return Array.isArray(body.message) ? body.message.join(' ') : body.message;
  }
  if (error.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Surfaces a human-readable toast for any error that propagates out of the auth
 * interceptor, then rethrows so components can still react if they need to.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const ui = inject(UiNotificationService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        ui.error(extractMessage(error));
      }
      return throwError(() => error);
    }),
  );
};
