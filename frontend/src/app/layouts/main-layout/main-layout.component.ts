import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Role } from '@app/models/auth.model';
import { AppNotification } from '@app/models/notification.model';
import { AuthService } from '@app/services/auth.service';
import { NotificationsService } from '@app/services/notifications.service';
import { HumanizePipe } from '@app/shared/pipes/humanize.pipe';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: Role[];
}

/** Primary authenticated shell: collapsible sidenav, toolbar, notifications, user menu. */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    HumanizePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav mode="side" opened class="sidenav">
        <div class="brand" routerLink="/dashboard">
          <div class="mark">SP</div>
          <span>Support Platform</span>
        </div>
        <mat-nav-list>
          @for (item of visibleNav(); track item.route) {
            <a
              mat-list-item
              [routerLink]="item.route"
              routerLinkActive="active-link"
            >
              <mat-icon matListItemIcon fontSet="material-symbols-outlined">
                {{ item.icon }}
              </mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="toolbar">
          <span class="spacer"></span>

          <button
            mat-icon-button
            [matMenuTriggerFor]="notifMenu"
            (menuOpened)="loadNotifications()"
            aria-label="Notifications"
          >
            <mat-icon
              fontSet="material-symbols-outlined"
              [matBadge]="unreadCount()"
              [matBadgeHidden]="unreadCount() === 0"
              matBadgeColor="warn"
              matBadgeSize="small"
            >
              notifications
            </mat-icon>
          </button>
          <mat-menu #notifMenu="matMenu" class="notif-menu">
            <div class="notif-header" (click)="$event.stopPropagation()">
              <strong>Notifications</strong>
              <button mat-button (click)="markAllRead()">Mark all read</button>
            </div>
            <mat-divider />
            @if (notifications().length === 0) {
              <div class="notif-empty">You're all caught up.</div>
            } @else {
              @for (n of notifications(); track n.id) {
                <button
                  mat-menu-item
                  class="notif-item"
                  [class.unread]="!n.isRead"
                  (click)="openNotification(n)"
                >
                  <span class="notif-title">{{ n.title }}</span>
                  <span class="notif-msg">{{ n.message }}</span>
                </button>
              }
            }
          </mat-menu>

          <button mat-button [matMenuTriggerFor]="userMenu" class="user-btn">
            <span class="avatar">{{ initials() }}</span>
            <span class="user-name">{{ auth.fullName() }}</span>
            <mat-icon fontSet="material-symbols-outlined">expand_more</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <div class="user-meta" (click)="$event.stopPropagation()">
              <div class="user-email">{{ auth.user()?.email }}</div>
              <div class="user-role">{{ auth.role() | humanize }}</div>
            </div>
            <mat-divider />
            <button mat-menu-item (click)="logout()">
              <mat-icon fontSet="material-symbols-outlined">logout</mat-icon>
              <span>Sign out</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <main class="content">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell {
        height: 100vh;
      }
      .sidenav {
        width: 256px;
        border-right: 1px solid var(--app-border);
        background: white;
        padding: 8px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 12px;
        cursor: pointer;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .mark {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        color: white;
        background: var(--mat-sys-primary);
        font-size: 14px;
        letter-spacing: 0.04em;
      }
      .active-link {
        --mat-list-active-indicator-shape: 10px;
        background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
        border-radius: 10px;
        color: var(--mat-sys-primary);
      }
      .active-link mat-icon {
        color: var(--mat-sys-primary);
      }
      .toolbar {
        background: white;
        border-bottom: 1px solid var(--app-border);
        position: sticky;
        top: 0;
        z-index: 5;
      }
      .content {
        min-height: calc(100vh - 64px);
      }
      .user-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 44px;
      }
      .avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--mat-sys-primary);
        color: white;
        font-size: 12px;
        font-weight: 600;
      }
      .user-name {
        font-weight: 500;
      }
      .user-meta {
        padding: 10px 16px;
      }
      .user-email {
        font-weight: 600;
        font-size: 14px;
      }
      .user-role {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.55);
      }
      .notif-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 8px 8px 16px;
      }
      .notif-empty {
        padding: 20px 16px;
        color: rgba(0, 0, 0, 0.55);
        font-size: 14px;
      }
      .notif-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.3;
        height: auto;
        padding: 10px 16px;
      }
      .notif-item.unread {
        background: color-mix(in srgb, var(--mat-sys-primary) 7%, transparent);
      }
      .notif-title {
        font-weight: 600;
        font-size: 13px;
      }
      .notif-msg {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        white-space: normal;
      }
    `,
  ],
})
export class MainLayoutComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly router = inject(Router);

  protected readonly unreadCount = this.notificationsService.unreadCount;
  protected readonly notifications = signal<AppNotification[]>([]);

  private readonly nav: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Tickets', icon: 'confirmation_number', route: '/tickets' },
    { label: 'Users', icon: 'group', route: '/users', roles: [Role.ADMIN] },
    {
      label: 'Organizations',
      icon: 'corporate_fare',
      route: '/organizations',
      roles: [Role.ADMIN],
    },
  ];

  protected readonly visibleNav = computed(() =>
    this.nav.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
  );

  protected readonly initials = computed(() => {
    const u = this.auth.user();
    if (!u) {
      return '';
    }
    return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
  });

  ngOnInit(): void {
    this.notificationsService.refreshUnreadCount().subscribe({
      error: () => undefined,
    });
  }

  protected loadNotifications(): void {
    this.notificationsService.list({ limit: 6 }).subscribe({
      next: (res) => this.notifications.set(res.items),
      error: () => undefined,
    });
  }

  protected openNotification(n: AppNotification): void {
    const done = () => {
      if (n.ticketId) {
        void this.router.navigate(['/tickets', n.ticketId]);
      }
    };
    if (!n.isRead) {
      this.notificationsService.markRead(n.id).subscribe({
        next: done,
        error: done,
      });
    } else {
      done();
    }
  }

  protected markAllRead(): void {
    this.notificationsService.markAllRead().subscribe({
      next: () =>
        this.notifications.update((list) =>
          list.map((n) => ({ ...n, isRead: true })),
        ),
      error: () => undefined,
    });
  }

  protected logout(): void {
    this.auth.logout();
  }
}
