import { Routes } from '@angular/router';

import { LocationExplorerComponent } from './features/location-explorer/location-explorer.component';
import { MapDashboardComponent } from './features/map-dashboard/map-dashboard.component';
import { NewsFeedComponent } from './features/news-feed/news-feed.component';
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
    path: 'feed',
    component: NewsFeedComponent,
  },
  {
    path: 'locations',
    component: LocationExplorerComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
