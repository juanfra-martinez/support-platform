import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PaginatedResult } from '@app/models/api-response.model';
import { PageQuery } from '@app/models/pagination.model';
import {
  CreateUserRequest,
  UpdateUserRequest,
  User,
} from '@app/models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  list(query: PageQuery): Observable<PaginatedResult<User>> {
    return this.api.getPaginated<User>('/users', query);
  }

  getById(id: string): Observable<User> {
    return this.api.get<User>(`/users/${id}`);
  }

  create(payload: CreateUserRequest): Observable<User> {
    return this.api.post<User>('/users', payload);
  }

  update(id: string, payload: UpdateUserRequest): Observable<User> {
    return this.api.patch<User>(`/users/${id}`, payload);
  }

  deactivate(id: string): Observable<void> {
    return this.api.delete<void>(`/users/${id}`);
  }
}
