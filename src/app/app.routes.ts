import { Routes } from '@angular/router';

import { MapDashboardComponent } from './features/map-dashboard/map-dashboard.component';
import { NewsDetailComponent } from './features/news-detail/news-detail.component';

export const routes: Routes = [
  {
    path: '',
    component: MapDashboardComponent,
  },
  {
    path: 'news/:id',
    component: NewsDetailComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
