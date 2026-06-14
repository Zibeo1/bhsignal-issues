import { Routes } from '@angular/router';

import { LiveEventsComponent } from './features/live-events/live-events.component';
import { LocationExplorerComponent } from './features/location-explorer/location-explorer.component';
import { MapDashboardComponent } from './features/map-dashboard/map-dashboard.component';
import { NewsFeedComponent } from './features/news-feed/news-feed.component';
import { NewsDetailComponent } from './features/news-detail/news-detail.component';
import { StatsComponent } from './features/stats/stats.component';

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
    path: 'live',
    component: LiveEventsComponent,
  },
  {
    path: 'stats',
    component: StatsComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
