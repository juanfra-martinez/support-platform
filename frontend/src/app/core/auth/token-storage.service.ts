import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'sp.accessToken';
const REFRESH_TOKEN_KEY = 'sp.refreshToken';

/**
 * Single owner of token persistence. Keeping this isolated means the storage
 * mechanism (localStorage today) can change without touching auth logic.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
