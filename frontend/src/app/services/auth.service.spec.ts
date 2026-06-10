import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Role } from '@app/models/auth.model';
import { TokenStorageService } from '@app/core/auth/token-storage.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenStorage: jasmine.SpyObj<TokenStorageService>;

  const authResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresIn: '15m',
    user: {
      id: 'u1',
      email: 'admin@acme.test',
      firstName: 'Ada',
      lastName: 'Admin',
      role: Role.ADMIN,
      organizationId: 'org-1',
    },
  };

  beforeEach(() => {
    const spy = jasmine.createSpyObj<TokenStorageService>(
      'TokenStorageService',
      ['setTokens', 'clear'],
      { accessToken: null, refreshToken: null },
    );

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TokenStorageService, useValue: spy },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(
      TokenStorageService,
    ) as jasmine.SpyObj<TokenStorageService>;
  });

  afterEach(() => httpMock.verify());

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.user()).toBeNull();
  });

  it('stores tokens and sets the user signal on login', () => {
    let emittedEmail: string | undefined;
    service
      .login({ email: 'admin@acme.test', password: 'Password123!' })
      .subscribe((user) => (emittedEmail = user.email));

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ data: authResponse });

    expect(emittedEmail).toBe('admin@acme.test');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.role()).toBe(Role.ADMIN);
    expect(service.fullName()).toBe('Ada Admin');
    expect(tokenStorage.setTokens).toHaveBeenCalledWith(
      'access-token',
      'refresh-token',
    );
  });

  it('clears state on logout', () => {
    service
      .login({ email: 'admin@acme.test', password: 'Password123!' })
      .subscribe();
    httpMock.expectOne('/api/auth/login').flush({ data: authResponse });

    service.logout(false);

    expect(service.isAuthenticated()).toBeFalse();
    expect(tokenStorage.clear).toHaveBeenCalled();
  });
});
