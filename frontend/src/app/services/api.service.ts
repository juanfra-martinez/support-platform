import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ApiEnvelope,
  PaginatedResult,
  PaginationMeta,
} from '@app/models/api-response.model';
import { PageQuery } from '@app/models/pagination.model';

/**
 * Thin HTTP facade shared by every feature service.
 *
 * - Prefixes the configured API base URL.
 * - Unwraps the standard `{ data, meta }` envelope so callers work with plain
 *   resources or a typed `PaginatedResult<T>`.
 * - Normalises query objects into HttpParams (dropping null/undefined).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private buildParams(query?: PageQuery): HttpParams {
    let params = new HttpParams();
    if (!query) {
      return params;
    }
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  get<T>(path: string, query?: PageQuery): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(`${this.baseUrl}${path}`, {
        params: this.buildParams(query),
      })
      .pipe(map((res) => res.data));
  }

  getPaginated<T>(path: string, query?: PageQuery): Observable<PaginatedResult<T>> {
    return this.http
      .get<ApiEnvelope<T[]>>(`${this.baseUrl}${path}`, {
        params: this.buildParams(query),
      })
      .pipe(
        map((res) => ({
          items: res.data,
          meta: res.meta as PaginationMeta,
        })),
      );
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((res) => res.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .patch<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body)
      .pipe(map((res) => res.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(`${this.baseUrl}${path}`)
      .pipe(map((res) => res.data));
  }
}
