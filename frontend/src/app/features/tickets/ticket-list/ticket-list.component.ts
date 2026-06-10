import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { DEFAULT_PAGE_SIZE } from '@app/models/pagination.model';
import {
  Ticket,
  TicketPriority,
  TicketStatus,
} from '@app/models/ticket.model';
import { TicketsService } from '@app/services/tickets.service';
import { CellTemplateDirective } from '@app/shared/components/data-table/cell-template.directive';
import {
  ColumnDef,
  DataTableComponent,
} from '@app/shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { LoadingBarComponent } from '@app/shared/components/loading-bar/loading-bar.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { StatusChipComponent } from '@app/shared/components/status-chip/status-chip.component';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';
import { TicketFormComponent } from '../ticket-form/ticket-form.component';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    DataTableComponent,
    CellTemplateDirective,
    PageHeaderComponent,
    StatusChipComponent,
    EmptyStateComponent,
    LoadingBarComponent,
    HumanizePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-loading-bar [loading]="loading()" />
    <div class="page-container">
      <app-page-header title="Tickets" subtitle="Track and resolve support requests">
        <button mat-flat-button color="primary" (click)="create()">
          <mat-icon fontSet="material-symbols-outlined">add</mat-icon>
          New ticket
        </button>
      </app-page-header>

      <mat-card class="filters">
        <mat-form-field class="search">
          <mat-icon matPrefix fontSet="material-symbols-outlined">search</mat-icon>
          <mat-label>Search</mat-label>
          <input matInput [formControl]="search" placeholder="Title or reference" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Status</mat-label>
          <mat-select [formControl]="statusFilter">
            <mat-option [value]="null">All statuses</mat-option>
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s | humanize }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field>
          <mat-label>Priority</mat-label>
          <mat-select [formControl]="priorityFilter">
            <mat-option [value]="null">All priorities</mat-option>
            @for (p of priorities; track p) {
              <mat-option [value]="p">{{ p | humanize }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-card>

      <mat-card class="table-card">
        @if (!loading() && total() === 0) {
          <app-empty-state
            icon="confirmation_number"
            title="No tickets found"
            message="Try adjusting your filters, or create the first ticket."
          >
            <button mat-flat-button color="primary" (click)="create()">
              New ticket
            </button>
          </app-empty-state>
        } @else {
          <app-data-table
            [columns]="columns"
            [data]="tickets()"
            [total]="total()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [sortActive]="sortActive()"
            [sortDirection]="sortDirection()"
            [clickable]="true"
            (pageChange)="onPage($event)"
            (sortChange)="onSort($event)"
            (rowClick)="open($event)"
          >
            <ng-template appCellTemplate="status" let-row>
              <app-status-chip [value]="row.status" kind="status" />
            </ng-template>
            <ng-template appCellTemplate="priority" let-row>
              <app-status-chip [value]="row.priority" kind="priority" />
            </ng-template>
          </app-data-table>
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .filters .search {
        flex: 1 1 280px;
      }
      .table-card {
        padding: 0 8px;
      }
      mat-icon[matPrefix] {
        margin-right: 8px;
        color: rgba(0, 0, 0, 0.5);
      }
    `,
  ],
})
export class TicketListComponent implements OnInit {
  private readonly ticketsService = inject(TicketsService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly statuses = Object.values(TicketStatus);
  protected readonly priorities = Object.values(TicketPriority);

  protected readonly search = new FormControl<string>('', { nonNullable: true });
  protected readonly statusFilter = new FormControl<TicketStatus | null>(null);
  protected readonly priorityFilter = new FormControl<TicketPriority | null>(null);

  protected readonly loading = signal(false);
  protected readonly tickets = signal<Ticket[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sortActive = signal('createdAt');
  protected readonly sortDirection = signal<'asc' | 'desc' | ''>('desc');

  protected readonly columns: ColumnDef[] = [
    { key: 'reference', header: 'Reference', sortable: true, width: '130px' },
    { key: 'title', header: 'Title' },
    { key: 'status', header: 'Status', sortable: true, width: '150px' },
    { key: 'priority', header: 'Priority', sortable: true, width: '130px' },
    { key: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '200px' },
  ];

  ngOnInit(): void {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetAndLoad());

    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetAndLoad());

    this.priorityFilter.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetAndLoad());

    this.load();
  }

  private resetAndLoad(): void {
    this.pageIndex.set(0);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const direction = this.sortDirection();
    this.ticketsService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        sort: direction ? `${this.sortActive()}:${direction}` : undefined,
        search: this.search.value || undefined,
        status: this.statusFilter.value ?? undefined,
        priority: this.priorityFilter.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.tickets.set(res.items);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected onSort(sort: Sort): void {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.load();
  }

  protected open(row: Ticket): void {
    void this.router.navigate(['/tickets', row.id]);
  }

  protected create(): void {
    this.dialog
      .open(TicketFormComponent, { data: {}, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((created?: Ticket) => {
        if (created) {
          this.resetAndLoad();
        }
      });
  }
}
