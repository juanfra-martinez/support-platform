import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { PaginatedResult } from '@app/models/api-response.model';
import { PageQuery } from '@app/models/pagination.model';
import { AppNotification } from '@app/models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);

  private readonly _unreadCount = signal(0);
  readonly unreadCount = this._unreadCount.asReadonly();

  list(query?: PageQuery): Observable<PaginatedResult<AppNotification>> {
    return this.api.getPaginated<AppNotification>('/notifications', query);
  }

  refreshUnreadCount(): Observable<{ unread: number }> {
    return this.api
      .get<{ unread: number }>('/notifications/unread-count')
      .pipe(tap((res) => this._unreadCount.set(res.unread)));
  }

  markRead(id: string): Observable<AppNotification> {
    return this.api
      .patch<AppNotification>(`/notifications/${id}/read`, {})
      .pipe(
        tap(() =>
          this._unreadCount.update((c) => (c > 0 ? c - 1 : 0)),
        ),
      );
  }

  markAllRead(): Observable<{ updated: number }> {
    return this.api
      .patch<{ updated: number }>('/notifications/read-all', {})
      .pipe(tap(() => this._unreadCount.set(0)));
  }
}
