import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '@app/models/auth.model';
import { AuthService } from '@app/services/auth.service';

/**
 * Restricts a route to specific roles via `data: { roles: [...] }`.
 * Redirects unauthorised users to the dashboard rather than leaking a 403.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowed = (route.data?.['roles'] as Role[] | undefined) ?? [];
  if (allowed.length === 0 || auth.hasRole(...allowed)) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
