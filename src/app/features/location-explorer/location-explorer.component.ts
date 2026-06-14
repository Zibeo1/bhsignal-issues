import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NewsItem } from '../../core/models/news-item.model';
import { NewsApiService } from '../../core/services/news-api.service';

interface LocationBucket {
  name: string;
  latitude: number | null;
  longitude: number | null;
  count: number;
  categories: string[];
  latestArticle: NewsItem;
}

@Component({
  selector: 'app-location-explorer',
  imports: [CommonModule, RouterLink],
  templateUrl: './location-explorer.component.html',
  styleUrl: './location-explorer.component.css',
})
export class LocationExplorerComponent implements OnInit {
  readonly articles = signal<NewsItem[]>([]);
  readonly loading = signal<boolean>(true);
  readonly selectedLocation = signal<string | null>(null);

  readonly locationBuckets = computed<LocationBucket[]>(() => {
    const map = new Map<string, LocationBucket>();

    this.articles().forEach((item) => {
      const key = item.locationName ?? 'Unknown';
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          name: key,
          latitude: item.latitude,
          longitude: item.longitude,
          count: 1,
          categories: item.category ? [item.category] : [],
          latestArticle: item,
        });
        return;
      }

      existing.count += 1;
      if (item.category && !existing.categories.includes(item.category)) {
        existing.categories.push(item.category);
      }
      if (Date.parse(item.publishedAt) > Date.parse(existing.latestArticle.publishedAt)) {
        existing.latestArticle = item;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  });

  readonly locationArticles = computed<NewsItem[]>(() => {
    const loc = this.selectedLocation();
    if (!loc) return [];
    return this.articles()
      .filter((item) => (item.locationName ?? 'Unknown') === loc)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  });

  constructor(private readonly newsApi: NewsApiService) {}

  ngOnInit(): void {
    this.newsApi.listNews({ limit: 200 }).subscribe((response) => {
      this.articles.set(response.items);
      this.loading.set(false);
    });
  }

  selectLocation(name: string): void {
    this.selectedLocation.set(this.selectedLocation() === name ? null : name);
  }

  formatCategory(category: string | null): string {
    if (!category) return 'General';
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  }

  relativeTime(timestamp: string): string {
    const deltaMs = Date.now() - Date.parse(timestamp);
    const hours = Math.max(0, Math.round(deltaMs / 3_600_000));
    if (hours < 1) {
      const minutes = Math.max(1, Math.round(deltaMs / 60_000));
      return `${minutes}m ago`;
    }
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }
}
