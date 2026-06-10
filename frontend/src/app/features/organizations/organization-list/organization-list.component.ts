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
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Organization } from '@app/models/organization.model';
import { DEFAULT_PAGE_SIZE } from '@app/models/pagination.model';
import { OrganizationsService } from '@app/services/organizations.service';
import { UiNotificationService } from '@app/services/ui-notification.service';
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
import {
  OrganizationFormComponent,
  OrganizationFormData,
} from '../organization-form/organization-form.component';

@Component({
  selector: 'app-organization-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    DataTableComponent,
    CellTemplateDirective,
    PageHeaderComponent,
    EmptyStateComponent,
    LoadingBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-loading-bar [loading]="loading()" />
    <div class="page-container">
      <app-page-header title="Organizations" subtitle="Tenants on the platform">
        <button mat-flat-button color="primary" (click)="create()">
          <mat-icon fontSet="material-symbols-outlined">add_business</mat-icon>
          New organization
        </button>
      </app-page-header>

      <mat-card class="filters">
        <mat-form-field class="search">
          <mat-icon matPrefix fontSet="material-symbols-outlined">search</mat-icon>
          <mat-label>Search</mat-label>
          <input matInput [formControl]="search" placeholder="Name or slug" />
        </mat-form-field>
      </mat-card>

      <mat-card class="table-card">
        @if (!loading() && total() === 0) {
          <app-empty-state
            icon="corporate_fare"
            title="No organizations found"
            message="Create the first organization to onboard a tenant."
          />
        } @else {
          <app-data-table
            [columns]="columns"
            [data]="organizations()"
            [total]="total()"
            [pageIndex]="pageIndex()"
            [pageSize]="pageSize()"
            [sortActive]="sortActive()"
            [sortDirection]="sortDirection()"
            (pageChange)="onPage($event)"
            (sortChange)="onSort($event)"
          >
            <ng-template appCellTemplate="slug" let-row>
              <code class="slug">{{ row.slug }}</code>
            </ng-template>
            <ng-template appCellTemplate="isActive" let-row>
              <span class="state" [class.off]="!row.isActive">
                {{ row.isActive ? 'Active' : 'Inactive' }}
              </span>
            </ng-template>
            <ng-template appCellTemplate="actions" let-row>
              <button mat-icon-button (click)="edit(row)" aria-label="Edit">
                <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
              </button>
              <button
                mat-icon-button
                color="warn"
                (click)="remove(row)"
                aria-label="Delete"
              >
                <mat-icon fontSet="material-symbols-outlined">delete</mat-icon>
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
      .slug {
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 12px;
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
export class OrganizationListComponent implements OnInit {
  private readonly organizationsService = inject(OrganizationsService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ui = inject(UiNotificationService);

  protected readonly search = new FormControl<string>('', { nonNullable: true });

  protected readonly loading = signal(false);
  protected readonly organizations = signal<Organization[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sortActive = signal('createdAt');
  protected readonly sortDirection = signal<'asc' | 'desc' | ''>('desc');

  protected readonly columns: ColumnDef[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'slug', header: 'Slug', width: '200px' },
    { key: 'isActive', header: 'State', width: '110px' },
    { key: 'createdAt', header: 'Created', type: 'date', sortable: true, width: '190px' },
    { key: 'actions', header: '', width: '110px' },
  ];

  ngOnInit(): void {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
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
    this.organizationsService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        sort: direction ? `${this.sortActive()}:${direction}` : undefined,
        search: this.search.value || undefined,
      })
      .subscribe({
        next: (res) => {
          this.organizations.set(res.items);
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
      .open(OrganizationFormComponent, { data: {}, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((org?: Organization) => {
        if (org) {
          this.resetAndLoad();
        }
      });
  }

  protected edit(row: Organization): void {
    const data: OrganizationFormData = { organization: row };
    this.dialog
      .open(OrganizationFormComponent, { data, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((org?: Organization) => {
        if (org) {
          this.load();
        }
      });
  }

  protected remove(org: Organization): void {
    const data: ConfirmDialogData = {
      title: 'Delete organization',
      message: `Delete "${org.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed?: boolean) => {
        if (confirmed) {
          this.organizationsService.remove(org.id).subscribe({
            next: () => {
              this.ui.success('Organization deleted');
              this.load();
            },
          });
        }
      });
  }
}
