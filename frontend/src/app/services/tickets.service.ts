import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PaginatedResult } from '@app/models/api-response.model';
import { PageQuery } from '@app/models/pagination.model';
import { Comment, CreateCommentRequest } from '@app/models/comment.model';
import {
  AssignTicketRequest,
  CreateTicketRequest,
  Ticket,
  UpdateTicketRequest,
} from '@app/models/ticket.model';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly api = inject(ApiService);

  list(query: PageQuery): Observable<PaginatedResult<Ticket>> {
    return this.api.getPaginated<Ticket>('/tickets', query);
  }

  getById(id: string): Observable<Ticket> {
    return this.api.get<Ticket>(`/tickets/${id}`);
  }

  create(payload: CreateTicketRequest): Observable<Ticket> {
    return this.api.post<Ticket>('/tickets', payload);
  }

  update(id: string, payload: UpdateTicketRequest): Observable<Ticket> {
    return this.api.patch<Ticket>(`/tickets/${id}`, payload);
  }

  assign(id: string, payload: AssignTicketRequest): Observable<Ticket> {
    return this.api.patch<Ticket>(`/tickets/${id}/assign`, payload);
  }

  listComments(
    ticketId: string,
    query?: PageQuery,
  ): Observable<PaginatedResult<Comment>> {
    return this.api.getPaginated<Comment>(
      `/tickets/${ticketId}/comments`,
      query,
    );
  }

  addComment(
    ticketId: string,
    payload: CreateCommentRequest,
  ): Observable<Comment> {
    return this.api.post<Comment>(`/tickets/${ticketId}/comments`, payload);
  }
}
