import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Role } from '@app/models/auth.model';
import { Comment } from '@app/models/comment.model';
import { Ticket, TicketStatus } from '@app/models/ticket.model';
import { User } from '@app/models/user.model';
import { AuthService } from '@app/services/auth.service';
import { TicketsService } from '@app/services/tickets.service';
import { UiNotificationService } from '@app/services/ui-notification.service';
import { UsersService } from '@app/services/users.service';
import { LoadingBarComponent } from '@app/shared/components/loading-bar/loading-bar.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { StatusChipComponent } from '@app/shared/components/status-chip/status-chip.component';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';
import {
  TicketFormComponent,
  TicketFormData,
} from '../ticket-form/ticket-form.component';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    StatusChipComponent,
    LoadingBarComponent,
    HumanizePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-loading-bar [loading]="loading()" />
    <div class="page-container">
      <button mat-button class="back" (click)="back()">
        <mat-icon fontSet="material-symbols-outlined">arrow_back</mat-icon>
        Back to tickets
      </button>

      @if (ticket(); as t) {
        <app-page-header [title]="t.title" [subtitle]="t.reference">
          @if (isStaff()) {
            <button mat-stroked-button (click)="edit(t)">
              <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
              Edit
            </button>
          }
        </app-page-header>

        <div class="layout">
          <div class="main">
            <mat-card class="block">
              <h3>Description</h3>
              <p class="description">{{ t.description }}</p>
            </mat-card>

            <mat-card class="block">
              <h3>Activity</h3>
              @if (comments().length === 0) {
                <p class="muted">No comments yet.</p>
              } @else {
                <ul class="comments">
                  @for (c of comments(); track c.id) {
                    <li [class.internal]="c.isInternal">
                      <div class="comment-head">
                        <span class="author">{{ authorLabel(c) }}</span>
                        @if (c.isInternal) {
                          <span class="badge">Internal</span>
                        }
                        <span class="when">{{ c.createdAt | date: 'medium' }}</span>
                      </div>
                      <p class="comment-body">{{ c.body }}</p>
                    </li>
                  }
                </ul>
              }

              <mat-divider />
              <form class="comment-form" (ngSubmit)="addComment()">
                <mat-form-field class="full-width">
                  <mat-label>Add a comment</mat-label>
                  <textarea matInput rows="3" [formControl]="commentBody"></textarea>
                </mat-form-field>
                <div class="comment-actions">
                  @if (isStaff()) {
                    <mat-checkbox [formControl]="commentInternal">
                      Internal note (hidden from customer)
                    </mat-checkbox>
                  }
                  <span class="spacer"></span>
                  <button
                    mat-flat-button
                    color="primary"
                    type="submit"
                    [disabled]="commentBody.invalid || posting()"
                  >
                    {{ posting() ? 'Posting…' : 'Comment' }}
                  </button>
                </div>
              </form>
            </mat-card>
          </div>

          <aside class="side">
            <mat-card class="block">
              <h3>Details</h3>
              <div class="meta">
                <span class="meta-label">Status</span>
                <app-status-chip [value]="t.status" kind="status" />
              </div>
              <div class="meta">
                <span class="meta-label">Priority</span>
                <app-status-chip [value]="t.priority" kind="priority" />
              </div>
              <div class="meta">
                <span class="meta-label">Category</span>
                <span>{{ t.category || '—' }}</span>
              </div>
              <div class="meta">
                <span class="meta-label">Created</span>
                <span>{{ t.createdAt | date: 'medium' }}</span>
              </div>
              <div class="meta">
                <span class="meta-label">Assignee</span>
                <span>{{ assigneeLabel() }}</span>
              </div>
            </mat-card>

            @if (isStaff()) {
              <mat-card class="block">
                <h3>Manage</h3>
                <mat-form-field class="full-width">
                  <mat-label>Status</mat-label>
                  <mat-select
                    [value]="t.status"
                    (selectionChange)="changeStatus($event.value)"
                  >
                    @for (s of statuses; track s) {
                      <mat-option [value]="s">{{ s | humanize }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                @if (isAdmin()) {
                  <mat-form-field class="full-width">
                    <mat-label>Assign to</mat-label>
                    <mat-select
                      [value]="t.assignedToId"
                      (selectionChange)="assign($event.value)"
                    >
                      @for (u of assignableUsers(); track u.id) {
                        <mat-option [value]="u.id">
                          {{ u.firstName }} {{ u.lastName }} ({{ u.role | humanize }})
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                } @else {
                  <button
                    mat-stroked-button
                    class="full-width"
                    (click)="assignToMe()"
                    [disabled]="t.assignedToId === auth.user()?.id"
                  >
                    Assign to me
                  </button>
                }
              </mat-card>
            }
          </aside>
        </div>
      } @else if (!loading()) {
        <p class="muted">Ticket not found.</p>
      }
    </div>
  `,
  styles: [
    `
      .back {
        margin-bottom: 8px;
      }
      .layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }
      .block {
        padding: 20px;
        margin-bottom: 16px;
      }
      .block h3 {
        margin: 0 0 12px;
        font-size: 15px;
        font-weight: 600;
      }
      .description {
        white-space: pre-wrap;
        line-height: 1.6;
        margin: 0;
      }
      .muted {
        color: rgba(0, 0, 0, 0.55);
      }
      .comments {
        list-style: none;
        padding: 0;
        margin: 0 0 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .comments li {
        padding: 12px 14px;
        border: 1px solid var(--app-border);
        border-radius: 10px;
      }
      .comments li.internal {
        background: color-mix(in srgb, var(--priority-high) 8%, transparent);
        border-color: color-mix(in srgb, var(--priority-high) 25%, transparent);
      }
      .comment-head {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        margin-bottom: 4px;
      }
      .author {
        font-weight: 600;
      }
      .badge {
        font-size: 10px;
        font-weight: 700;
        color: var(--priority-high);
        border: 1px solid currentColor;
        border-radius: 999px;
        padding: 0 6px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .when {
        color: rgba(0, 0, 0, 0.5);
        margin-left: auto;
      }
      .comment-body {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.5;
      }
      .comment-form {
        margin-top: 16px;
      }
      .comment-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--app-border);
        font-size: 14px;
      }
      .meta:last-child {
        border-bottom: none;
      }
      .meta-label {
        color: rgba(0, 0, 0, 0.55);
      }
    `,
  ],
})
export class TicketDetailComponent implements OnInit {
  readonly id = input.required<string>();

  protected readonly auth = inject(AuthService);
  private readonly ticketsService = inject(TicketsService);
  private readonly usersService = inject(UsersService);
  private readonly ui = inject(UiNotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly statuses = Object.values(TicketStatus);

  protected readonly loading = signal(false);
  protected readonly posting = signal(false);
  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly comments = signal<Comment[]>([]);
  protected readonly users = signal<User[]>([]);

  protected readonly isStaff = computed(() =>
    this.auth.hasRole(Role.ADMIN, Role.AGENT),
  );
  protected readonly isAdmin = computed(() => this.auth.hasRole(Role.ADMIN));
  protected readonly assignableUsers = computed(() =>
    this.users().filter((u) => u.role !== Role.CUSTOMER && u.isActive),
  );

  private readonly usersById = computed(() => {
    const map = new Map<string, User>();
    for (const u of this.users()) {
      map.set(u.id, u);
    }
    return map;
  });

  protected readonly commentBody = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(1)],
  });
  protected readonly commentInternal = new FormControl<boolean>(false, {
    nonNullable: true,
  });

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.usersService.list({ limit: 100 }).subscribe({
        next: (res) => this.users.set(res.items),
        error: () => undefined,
      });
    }
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      ticket: this.ticketsService.getById(this.id()),
      comments: this.ticketsService.listComments(this.id(), { limit: 100 }),
    }).subscribe({
      next: (res) => {
        this.ticket.set(res.ticket);
        this.comments.set(res.comments.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected authorLabel(c: Comment): string {
    const u = this.usersById().get(c.authorId);
    if (u) {
      return `${u.firstName} ${u.lastName}`;
    }
    return c.authorId === this.auth.user()?.id ? 'You' : 'User';
  }

  protected assigneeLabel(): string {
    const t = this.ticket();
    if (!t?.assignedToId) {
      return 'Unassigned';
    }
    const u = this.usersById().get(t.assignedToId);
    return u ? `${u.firstName} ${u.lastName}` : 'Assigned';
  }

  protected changeStatus(status: TicketStatus): void {
    const t = this.ticket();
    if (!t || t.status === status) {
      return;
    }
    this.ticketsService.update(t.id, { status }).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.ui.success(`Status set to ${status.replace(/_/g, ' ').toLowerCase()}`);
      },
    });
  }

  protected assign(assigneeId: string): void {
    const t = this.ticket();
    if (!t || !assigneeId) {
      return;
    }
    this.ticketsService.assign(t.id, { assigneeId }).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.ui.success('Ticket assigned');
      },
    });
  }

  protected assignToMe(): void {
    const me = this.auth.user();
    if (me) {
      this.assign(me.id);
    }
  }

  protected addComment(): void {
    if (this.commentBody.invalid || this.posting()) {
      return;
    }
    const t = this.ticket();
    if (!t) {
      return;
    }
    this.posting.set(true);
    this.ticketsService
      .addComment(t.id, {
        body: this.commentBody.value,
        isInternal: this.isStaff() ? this.commentInternal.value : false,
      })
      .subscribe({
        next: (comment) => {
          this.comments.update((list) => [...list, comment]);
          this.commentBody.reset('');
          this.commentInternal.reset(false);
          this.posting.set(false);
        },
        error: () => this.posting.set(false),
      });
  }

  protected edit(ticket: Ticket): void {
    const data: TicketFormData = { ticket };
    this.dialog
      .open(TicketFormComponent, { data, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((updated?: Ticket) => {
        if (updated) {
          this.ticket.set(updated);
        }
      });
  }

  protected back(): void {
    void this.router.navigate(['/tickets']);
  }
}
