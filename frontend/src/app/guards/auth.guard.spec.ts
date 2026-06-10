import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '@app/services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let isAuthenticated: boolean;
  const redirectTree = {} as UrlTree;
  let router: { createUrlTree: jasmine.Spy };

  function run() {
    return TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/tickets' } as RouterStateSnapshot,
      ),
    );
  }

  beforeEach(() => {
    isAuthenticated = false;
    router = { createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue(redirectTree) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('allows access when authenticated', () => {
    isAuthenticated = true;
    expect(run()).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to login (preserving the target) when unauthenticated', () => {
    isAuthenticated = false;
    const result = run();
    expect(result).toBe(redirectTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { redirectTo: '/tickets' },
    });
  });
});
