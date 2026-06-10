import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Ticket, TicketStatus } from '@app/models/ticket.model';
import { TicketsService } from '@app/services/tickets.service';
import { AuthService } from '@app/services/auth.service';
import {
  ColumnDef,
  DataTableComponent,
} from '@app/shared/components/data-table/data-table.component';
import { CellTemplateDirective } from '@app/shared/components/data-table/cell-template.directive';
import { PageHeaderComponent } from '@app/shared/components/page-header/page-header.component';
import { StatusChipComponent } from '@app/shared/components/status-chip/status-chip.component';
import { LoadingBarComponent } from '@app/shared/components/loading-bar/loading-bar.component';

interface StatCard {
  label: string;
  value: number;
  token: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatCardModule,
    DataTableComponent,
    CellTemplateDirective,
    PageHeaderComponent,
    StatusChipComponent,
    LoadingBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-loading-bar [loading]="loading()" />
    <div class="page-container">
      <app-page-header
        title="Dashboard"
        [subtitle]="'Welcome back, ' + auth.user()?.firstName"
      />

      <section class="stats">
        @for (card of stats(); track card.label) {
          <mat-card class="stat" [style.--accent]="'var(--status-' + card.token + ')'">
            <span class="value">{{ card.value }}</span>
            <span class="label">{{ card.label }}</span>
          </mat-card>
        }
      </section>

      <mat-card class="recent">
        <div class="recent-head">
          <h2>Recent tickets</h2>
        </div>
        <app-data-table
          [columns]="columns"
          [data]="recent()"
          [clickable]="true"
          (rowClick)="open($event)"
        >
          <ng-template appCellTemplate="status" let-row>
            <app-status-chip [value]="row.status" kind="status" />
          </ng-template>
          <ng-template appCellTemplate="priority" let-row>
            <app-status-chip [value]="row.priority" kind="priority" />
          </ng-template>
        </app-data-table>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      .stat {
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        border-left: 3px solid var(--accent);
      }
      .stat .value {
        font-size: 30px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--accent);
      }
      .stat .label {
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
      }
      .recent {
        padding: 8px 8px 0;
      }
      .recent-head {
        padding: 12px 12px 4px;
      }
      .recent-head h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly ticketsService = inject(TicketsService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly stats = signal<StatCard[]>([]);
  protected readonly recent = signal<Ticket[]>([]);

  protected readonly columns: ColumnDef[] = [
    { key: 'reference', header: 'Reference', width: '130px' },
    { key: 'title', header: 'Title' },
    { key: 'status', header: 'Status', width: '150px' },
    { key: 'priority', header: 'Priority', width: '130px' },
    { key: 'createdAt', header: 'Created', type: 'date', width: '200px' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      total: this.ticketsService.list({ limit: 1 }),
      open: this.ticketsService.list({ limit: 1, status: TicketStatus.OPEN }),
      inProgress: this.ticketsService.list({
        limit: 1,
        status: TicketStatus.IN_PROGRESS,
      }),
      resolved: this.ticketsService.list({
        limit: 1,
        status: TicketStatus.RESOLVED,
      }),
      recent: this.ticketsService.list({ limit: 5, sort: 'createdAt:desc' }),
    }).subscribe({
      next: (r) => {
        this.stats.set([
          { label: 'Open', value: r.open.meta.total, token: 'open' },
          {
            label: 'In progress',
            value: r.inProgress.meta.total,
            token: 'in_progress',
          },
          { label: 'Resolved', value: r.resolved.meta.total, token: 'resolved' },
          { label: 'Total tickets', value: r.total.meta.total, token: 'closed' },
        ]);
        this.recent.set(r.recent.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected open(row: Ticket): void {
    void this.router.navigate(['/tickets', row.id]);
  }
}
