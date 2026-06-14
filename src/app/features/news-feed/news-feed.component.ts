import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NewsItem } from '../../core/models/news-item.model';
import { NewsApiService } from '../../core/services/news-api.service';

@Component({
  selector: 'app-news-feed',
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  templateUrl: './news-feed.component.html',
  styleUrl: './news-feed.component.css',
})
export class NewsFeedComponent implements OnInit {
  readonly articles = signal<NewsItem[]>([]);
  readonly loading = signal<boolean>(true);
  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string>('all');

  readonly categories = computed(() => {
    const distinct = new Set<string>();
    this.articles().forEach((item) => {
      if (item.category) distinct.add(item.category);
    });
    return ['all', ...Array.from(distinct).sort((a, b) => a.localeCompare(b))];
  });

  readonly filteredArticles = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    return this.articles().filter((item) => {
      if (cat !== 'all' && item.category !== cat) return false;
      if (!q) return true;
      return [item.title, item.summary, item.locationName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  });

  constructor(private readonly newsApi: NewsApiService) {}

  ngOnInit(): void {
    this.newsApi.listNews({ limit: 100 }).subscribe((response) => {
      this.articles.set(response.items);
      this.loading.set(false);
    });
  }

  setCategory(cat: string): void {
    this.selectedCategory.set(cat === this.selectedCategory() ? 'all' : cat);
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
