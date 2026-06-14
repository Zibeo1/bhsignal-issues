import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NewsItem } from '../../core/models/news-item.model';
import { NewsApiService } from '../../core/services/news-api.service';

interface CategoryStat {
  key: string;
  label: string;
  count: number;
  percent: number;
}

interface LocationStat {
  name: string;
  count: number;
  percent: number;
}

@Component({
  selector: 'app-stats',
  imports: [CommonModule, RouterLink],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class StatsComponent implements OnInit {
  readonly articles = signal<NewsItem[]>([]);
  readonly loading = signal<boolean>(true);

  readonly totalArticles = computed(() => this.articles().length);

  readonly categoryStats = computed<CategoryStat[]>(() => {
    const counts = new Map<string, number>();
    this.articles().forEach((item) => {
      const key = (item.category ?? 'GENERAL').toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const total = this.articles().length || 1;
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: key.charAt(0) + key.slice(1).toLowerCase(),
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  });

  readonly locationStats = computed<LocationStat[]>(() => {
    const counts = new Map<string, number>();
    this.articles().forEach((item) => {
      const key = item.locationName ?? 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const total = this.articles().length || 1;
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  });

  readonly locatedPercent = computed(() => {
    const located = this.articles().filter(
      (item) => item.latitude !== null && item.longitude !== null,
    ).length;
    const total = this.articles().length || 1;
    return Math.round((located / total) * 100);
  });

  readonly uniqueLocations = computed(
    () => new Set(this.articles().map((item) => item.locationName ?? 'Unknown')).size,
  );

  constructor(private readonly newsApi: NewsApiService) {}

  ngOnInit(): void {
    this.newsApi.listNews({ limit: 500 }).subscribe((response) => {
      this.articles.set(response.items);
      this.loading.set(false);
    });
  }
}
