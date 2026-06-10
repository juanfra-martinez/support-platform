import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  filter,
  Observable,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { TokenStorageService } from '@app/core/auth/token-storage.service';
import { AuthService } from '@app/services/auth.service';

const AUTH_FREE_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

// Shared refresh state so concurrent 401s trigger a single refresh call.
let isRefreshing = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

function addToken(
  req: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Attaches the access token and transparently refreshes it on a 401, retrying
 * the original request. If refresh fails the user is logged out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const auth = inject(AuthService);

  const isAuthFree = AUTH_FREE_PATHS.some((p) => req.url.includes(p));
  const accessToken = tokenStorage.accessToken;

  const authReq =
    accessToken && !isAuthFree ? addToken(req, accessToken) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isAuthFree &&
        tokenStorage.refreshToken
      ) {
        return handle401(req, next, auth, tokenStorage);
      }
      return throwError(() => error);
    }),
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  tokenStorage: TokenStorageService,
): Observable<HttpEvent<unknown>> {
  if (isRefreshing) {
    // Queue until the in-flight refresh completes, then retry with new token.
    return refreshedToken$.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next(addToken(req, token))),
    );
  }

  isRefreshing = true;
  refreshedToken$.next(null);

  return auth.refreshTokens().pipe(
    switchMap((tokens) => {
      isRefreshing = false;
      refreshedToken$.next(tokens.accessToken);
      return next(addToken(req, tokens.accessToken));
    }),
    catchError((error: unknown) => {
      isRefreshing = false;
      auth.logout();
      return throwError(() => error);
    }),
  );
}
