import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '@app/models/pagination.model';
import { CellTemplateDirective } from './cell-template.directive';

export interface ColumnDef {
  key: string;
  header: string;
  sortable?: boolean;
  type?: 'text' | 'date';
  width?: string;
}

/**
 * Configuration-driven table with server-side pagination and sorting.
 *
 * Columns are declared with a `ColumnDef[]`; any column can be given a bespoke
 * renderer via the `appCellTemplate` directive. Pagination and sort changes are
 * emitted upward — the parent owns data fetching, keeping the table stateless.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    DatePipe,
    NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table
        mat-table
        [dataSource]="data()"
        matSort
        [matSortActive]="sortActive()"
        [matSortDirection]="sortDirection()"
        (matSortChange)="sortChange.emit($event)"
      >
        @for (col of columns(); track col.key) {
          <ng-container [matColumnDef]="col.key">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              [disabled]="!col.sortable"
              [style.width]="col.width || null"
            >
              {{ col.header }}
            </th>
            <td mat-cell *matCellDef="let row">
              @if (templateFor(col.key); as tpl) {
                <ng-container
                  [ngTemplateOutlet]="tpl"
                  [ngTemplateOutletContext]="{ $implicit: row }"
                />
              } @else if (col.type === 'date') {
                {{ $any(row)[col.key] | date: 'MMM d, y, h:mm a' }}
              } @else {
                {{ $any(row)[col.key] }}
              }
            </td>
          </ng-container>
        }

        <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: displayedColumns()"
          [class.clickable]="clickable()"
          (click)="onRowClick(row)"
        ></tr>
      </table>
    </div>

    <mat-paginator
      [length]="total()"
      [pageSize]="pageSize()"
      [pageIndex]="pageIndex()"
      [pageSizeOptions]="pageSizeOptions()"
      (page)="pageChange.emit($event)"
      showFirstLastButtons
    />
  `,
  styles: [
    `
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
      }
      tr.clickable {
        cursor: pointer;
        transition: background 120ms ease;
      }
      tr.clickable:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
      }
      th {
        font-weight: 600;
        color: rgba(0, 0, 0, 0.62);
      }
    `,
  ],
})
export class DataTableComponent<T> {
  readonly columns = input.required<ColumnDef[]>();
  readonly data = input.required<readonly T[]>();
  readonly total = input<number>(0);
  readonly pageIndex = input<number>(0);
  readonly pageSize = input<number>(DEFAULT_PAGE_SIZE);
  readonly pageSizeOptions = input<number[]>(PAGE_SIZE_OPTIONS);
  readonly sortActive = input<string>('');
  readonly sortDirection = input<SortDirection>('');
  readonly clickable = input<boolean>(false);

  readonly pageChange = output<PageEvent>();
  readonly sortChange = output<Sort>();
  readonly rowClick = output<T>();

  private readonly cellTemplates = contentChildren(CellTemplateDirective);

  protected readonly displayedColumns = computed(() =>
    this.columns().map((c) => c.key),
  );

  private readonly templateMap = computed(() => {
    const map = new Map<string, TemplateRef<{ $implicit: unknown }>>();
    for (const directive of this.cellTemplates()) {
      map.set(directive.columnKey(), directive.template);
    }
    return map;
  });

  protected templateFor(
    key: string,
  ): TemplateRef<{ $implicit: unknown }> | null {
    return this.templateMap().get(key) ?? null;
  }

  protected onRowClick(row: T): void {
    if (this.clickable()) {
      this.rowClick.emit(row);
    }
  }
}
