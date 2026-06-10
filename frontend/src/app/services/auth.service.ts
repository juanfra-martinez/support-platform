import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import { TokenStorageService } from '@app/core/auth/token-storage.service';
import {
  ApiEnvelope,
} from '@app/models/api-response.model';
import {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  Role,
} from '@app/models/auth.model';

/**
 * Authentication state container.
 *
 * Exposes the current user as a signal so components and guards can react
 * without subscriptions. Holds the only knowledge of how to talk to the auth
 * endpoints and how to hydrate the session on app start.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _initialized = signal(false);

  /** Current authenticated user, or null. */
  readonly user = this._user.asReadonly();
  /** True once the initial session-restore attempt has resolved. */
  readonly initialized = this._initialized.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<Role | null>(() => this._user()?.role ?? null);
  readonly fullName = computed(() => {
    const u = this._user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });

  hasRole(...roles: Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  /** Called once at startup to restore a session from a stored token. */
  restoreSession(): Observable<AuthUser | null> {
    if (!this.tokenStorage.accessToken) {
      this._initialized.set(true);
      return new Observable<AuthUser | null>((sub) => {
        sub.next(null);
        sub.complete();
      });
    }
    return this.http
      .get<ApiEnvelope<AuthUser>>(`${this.baseUrl}/auth/me`)
      .pipe(
        map((res) => res.data),
        tap((user) => {
          this._user.set(user);
          this._initialized.set(true);
        }),
      );
  }

  login(credentials: LoginRequest): Observable<AuthUser> {
    return this.http
      .post<ApiEnvelope<AuthResponse>>(
        `${this.baseUrl}/auth/login`,
        credentials,
      )
      .pipe(
        map((res) => res.data),
        tap((auth) => this.applySession(auth)),
        map((auth) => auth.user),
      );
  }

  register(payload: RegisterRequest): Observable<AuthUser> {
    return this.http
      .post<ApiEnvelope<AuthResponse>>(
        `${this.baseUrl}/auth/register`,
        payload,
      )
      .pipe(
        map((res) => res.data),
        tap((auth) => this.applySession(auth)),
        map((auth) => auth.user),
      );
  }

  /** Used by the auth interceptor to transparently refresh the access token. */
  refreshTokens(): Observable<AuthTokens> {
    const refreshToken = this.tokenStorage.refreshToken;
    return this.http
      .post<ApiEnvelope<AuthTokens>>(`${this.baseUrl}/auth/refresh`, {
        refreshToken,
      })
      .pipe(
        map((res) => res.data),
        tap((tokens) =>
          this.tokenStorage.setTokens(
            tokens.accessToken,
            tokens.refreshToken,
          ),
        ),
      );
  }

  logout(navigate = true): void {
    const refreshToken = this.tokenStorage.refreshToken;
    if (refreshToken) {
      // Fire-and-forget revoke; local state is cleared regardless.
      this.http
        .post(`${this.baseUrl}/auth/logout`, { refreshToken })
        .subscribe({ error: () => undefined });
    }
    this.tokenStorage.clear();
    this._user.set(null);
    if (navigate) {
      void this.router.navigate(['/auth/login']);
    }
  }

  private applySession(auth: AuthResponse): void {
    this.tokenStorage.setTokens(auth.accessToken, auth.refreshToken);
    this._user.set(auth.user);
  }
}
