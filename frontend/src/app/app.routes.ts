import { Routes } from '@angular/router';
import { Role } from '@app/models/auth.model';
import { authGuard } from '@app/guards/auth.guard';
import { roleGuard } from '@app/guards/role.guard';
import { MainLayoutComponent } from '@app/layouts/main-layout/main-layout.component';
import { AuthLayoutComponent } from '@app/layouts/auth-layout/auth-layout.component';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayoutComponent,
    loadChildren: () =>
      import('@app/features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('@app/features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
        title: 'Dashboard · Support Platform',
      },
      {
        path: 'tickets',
        loadChildren: () =>
          import('@app/features/tickets/tickets.routes').then(
            (m) => m.TICKETS_ROUTES,
          ),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: [Role.ADMIN] },
        loadChildren: () =>
          import('@app/features/users/users.routes').then(
            (m) => m.USERS_ROUTES,
          ),
      },
      {
        path: 'organizations',
        canActivate: [roleGuard],
        data: { roles: [Role.ADMIN] },
        loadChildren: () =>
          import('@app/features/organizations/organizations.routes').then(
            (m) => m.ORGANIZATIONS_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
