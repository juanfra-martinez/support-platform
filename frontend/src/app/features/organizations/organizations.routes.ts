import { Routes } from '@angular/router';

export const ORGANIZATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./organization-list/organization-list.component').then(
        (m) => m.OrganizationListComponent,
      ),
    title: 'Organizations · Support Platform',
  },
];
