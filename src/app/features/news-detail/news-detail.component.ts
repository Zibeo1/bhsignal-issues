import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import * as L from 'leaflet';

import { NewsItem } from '../../core/models/news-item.model';
import { NewsApiService } from '../../core/services/news-api.service';

@Component({
  selector: 'app-news-detail',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './news-detail.component.html',
  styleUrl: './news-detail.component.css',
})
export class NewsDetailComponent implements AfterViewInit, OnDestroy {
  @ViewChild('miniMapContainer')
  private readonly miniMapContainer?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly newsApi = inject(NewsApiService);

  readonly article = signal<NewsItem | null>(null);
  readonly loading = signal<boolean>(true);
  readonly notFound = signal<boolean>(false);

  private miniMap?: L.Map;
  private mapRendered = false;

  constructor() {
    effect(() => {
      const item = this.article();
      if (!item || this.mapRendered) {
        return;
      }
      queueMicrotask(() => this.renderMiniMap(item));
    });
  }

  ngAfterViewInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }

    this.newsApi.getNewsById(id).subscribe((item: NewsItem | null) => {
      this.loading.set(false);
      if (!item) {
        this.notFound.set(true);
        return;
      }
      this.article.set(item);
    });
  }

  ngOnDestroy(): void {
    this.miniMap?.remove();
  }

  formatCategory(category: string | null): string {
    if (!category) {
      return 'General';
    }
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  }

  hasCoordinates(item: NewsItem): boolean {
    return item.latitude !== null && item.longitude !== null;
  }

  private renderMiniMap(item: NewsItem): void {
    if (!this.miniMapContainer || item.latitude === null || item.longitude === null) {
      return;
    }

    this.miniMap = L.map(this.miniMapContainer.nativeElement, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([item.latitude, item.longitude], 8);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 18,
    }).addTo(this.miniMap);

    L.circleMarker([item.latitude, item.longitude], {
      radius: 12,
      color: '#ff5a58',
      weight: 3,
      fillColor: '#ff5a58',
      fillOpacity: 0.85,
    })
      .bindTooltip(item.locationName ?? 'Location', { permanent: false, direction: 'top' })
      .addTo(this.miniMap);

    this.mapRendered = true;
  }
}
