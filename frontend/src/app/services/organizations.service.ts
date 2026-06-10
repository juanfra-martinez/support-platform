import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PaginatedResult } from '@app/models/api-response.model';
import { PageQuery } from '@app/models/pagination.model';
import {
  CreateOrganizationRequest,
  Organization,
  UpdateOrganizationRequest,
} from '@app/models/organization.model';

@Injectable({ providedIn: 'root' })
export class OrganizationsService {
  private readonly api = inject(ApiService);

  list(query: PageQuery): Observable<PaginatedResult<Organization>> {
    return this.api.getPaginated<Organization>('/organizations', query);
  }

  getById(id: string): Observable<Organization> {
    return this.api.get<Organization>(`/organizations/${id}`);
  }

  create(payload: CreateOrganizationRequest): Observable<Organization> {
    return this.api.post<Organization>('/organizations', payload);
  }

  update(
    id: string,
    payload: UpdateOrganizationRequest,
  ): Observable<Organization> {
    return this.api.patch<Organization>(`/organizations/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/organizations/${id}`);
  }
}
