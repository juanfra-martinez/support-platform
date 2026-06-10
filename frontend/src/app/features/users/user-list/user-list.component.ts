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
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Role } from '@app/models/auth.model';
import { DEFAULT_PAGE_SIZE } from '@app/models/pagination.model';
import { User } from '@app/models/user.model';
import { UiNotificationService } from '@app/services/ui-notification.service';
import { UsersService } from '@app/services/users.service';
import { CellTemplateDirective } from '@app/shared/components/data-table/cell-template.directive';
import {
  ColumnDef,
  DataTableComponent,
} from '@app/shared/components/data-table/data-table.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@app/shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@app/shared/components/empty-state/empty-state.component';
import { LoadingBarComponent } from '@app/shared/components/loading-bar/loading-bar.component';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';
import {
  UserFormComponent,
  UserFormData,
} from '../user-form/user-form.component';

@Component({
  selector: 'app-user-list',
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
    EmptyStateComponent,
    LoadingBarComponent,
    HumanizePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-loading-bar [loading]="loading()" />
    <div class="page-container">
      <app-page-header title="Users" subtitle="Manage who can access your workspace">
        <button mat-flat-button color="primary" (click)="create()">
          <mat-icon fontSet="material-symbols-outlined">person_add</mat-icon>
          Invite user
        </button>
      </app-page-header>

      <mat-card class="filters">
        <mat-form-field class="search">
          <mat-icon matPrefix fontSet="material-symbols-outlined">search</mat-icon>
          <mat-label>Search</mat-label>
          <input matInput [formControl]="search" placeholder="Name or email" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Role</mat-label>
          <mat-select [formControl]="roleFilter">
            <mat-option [value]="null">All roles</mat-option>
            @for (r of roles; track r) {
              <mat-option [value]="r">{{ r | humanize }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-card>

      <mat-card class="table-card">
        @if (!loading() && total() === 0) {
          <app-empty-state
            icon="group"
            title="No users found"
            message="Invite a teammate to get started."
          />
        } @else {
          <app-data-table
            [columns]="columns"
            [data]="users()"
            [total]="total()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [sortActive]="sortActive()"
            [sortDirection]="sortDirection()"
            (pageChange)="onPage($event)"
            (sortChange)="onSort($event)"
          >
            <ng-template appCellTemplate="name" let-row>
              {{ row.firstName }} {{ row.lastName }}
            </ng-template>
            <ng-template appCellTemplate="role" let-row>
              <span class="role-chip">{{ row.role | humanize }}</span>
            </ng-template>
            <ng-template appCellTemplate="isActive" let-row>
              <span class="state" [class.off]="!row.isActive">
                {{ row.isActive ? 'Active' : 'Inactive' }}
              </span>
            </ng-template>
            <ng-template appCellTemplate="actions" let-row>
              <button mat-icon-button (click)="edit(row); $event.stopPropagation()" aria-label="Edit">
                <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
              </button>
              <button
                mat-icon-button
                color="warn"
                [disabled]="!row.isActive"
                (click)="deactivate(row); $event.stopPropagation()"
                aria-label="Deactivate"
              >
                <mat-icon fontSet="material-symbols-outlined">person_off</mat-icon>
              </button>
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
      .role-chip {
        font-size: 12px;
        font-weight: 600;
        padding: 2px 10px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.05);
      }
      .state {
        font-size: 13px;
        font-weight: 600;
        color: var(--status-resolved);
      }
      .state.off {
        color: var(--status-closed);
      }
    `,
  ],
})
export class UserListComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ui = inject(UiNotificationService);

  protected readonly roles = Object.values(Role);

  protected readonly search = new FormControl<string>('', { nonNullable: true });
  protected readonly roleFilter = new FormControl<Role | null>(null);

  protected readonly loading = signal(false);
  protected readonly users = signal<User[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sortActive = signal('createdAt');
  protected readonly sortDirection = signal<'asc' | 'desc' | ''>('desc');

  protected readonly columns: ColumnDef[] = [
    { key: 'name', header: 'Name', sortable: false },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'role', header: 'Role', sortable: true, width: '130px' },
    { key: 'isActive', header: 'State', width: '110px' },
    { key: 'createdAt', header: 'Joined', type: 'date', sortable: true, width: '190px' },
    { key: 'actions', header: '', width: '110px' },
  ];

  ngOnInit(): void {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetAndLoad());
    this.roleFilter.valueChanges
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
    this.usersService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        sort: direction ? `${this.sortActive()}:${direction}` : undefined,
        search: this.search.value || undefined,
        role: this.roleFilter.value ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.items);
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

  protected create(): void {
    this.dialog
      .open(UserFormComponent, { data: {}, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((user?: User) => {
        if (user) {
          this.resetAndLoad();
        }
      });
  }

  protected edit(row: User): void {
    const data: UserFormData = { user: row };
    this.dialog
      .open(UserFormComponent, { data, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((user?: User) => {
        if (user) {
          this.load();
        }
      });
  }

  protected deactivate(user: User): void {
    const data: ConfirmDialogData = {
      title: 'Deactivate user',
      message: `${user.firstName} ${user.lastName} will lose access immediately. You can re-activate them later.`,
      confirmLabel: 'Deactivate',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed?: boolean) => {
        if (confirmed) {
          this.usersService.deactivate(user.id).subscribe({
            next: () => {
              this.ui.success('User deactivated');
              this.load();
            },
          });
        }
      });
  }
}
