import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import * as L from 'leaflet';
import { Subscription, interval } from 'rxjs';

import { NewsItem } from '../../core/models/news-item.model';
import { NewsApiService } from '../../core/services/news-api.service';

const POLLING_INTERVAL_MS = 45_000;

interface MapCircle {
  key: string;
  locationName: string;
  latitude: number;
  longitude: number;
  count: number;
  latestPublishedAt: string;
  articles: NewsItem[];
  primaryCategory: string;
}

interface CategorySummary {
  key: string;
  label: string;
  count: number;
  color: string;
}

interface ActivityItem {
  id: string;
  type: 'created' | 'updated';
  title: string;
  locationName: string | null;
  category: string | null;
  publishedAt: string;
  url: string;
  createdAt: string;
}

interface UpsertResult {
  inserted: NewsItem[];
  updated: NewsItem[];
}

type NotificationMode = 'all' | 'unread';

interface CategoryVisual {
  circleStroke: string;
  circleFill: string;
  pulseRing: string;
  pulseCore: string;
}

@Component({
  selector: 'app-map-dashboard',
  imports: [CommonModule, FormsModule, DatePipe, RouterLink],
  templateUrl: './map-dashboard.component.html',
  styleUrl: './map-dashboard.component.css',
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(18px)' }),
        animate(
          '500ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
    trigger('staggerItems', [
      transition('* => *', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(8px)' }),
            stagger(
              55,
              animate(
                '380ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                style({ opacity: 1, transform: 'translateY(0)' }),
              ),
            ),
          ],
          { optional: true },
        ),
      ]),
    ]),
  ],
})
export class MapDashboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('feedList')
  private readonly feedList?: ElementRef<HTMLDivElement>;

  readonly searchQuery = signal('');
  readonly selectedCategory = signal('all');
  readonly selectedPrecision = signal('all');
  readonly hoursBack = signal(24);
  readonly focusedCircleKey = signal<string | null>(null);
  readonly isStreaming = signal(false);
  readonly lastSyncAt = signal<Date | null>(null);
  readonly allNews = signal<NewsItem[]>([]);
  readonly legendVisible = signal(true);
  readonly isNotificationsOpen = signal(false);
  readonly isLoginOpen = signal(false);
  readonly activityItems = signal<ActivityItem[]>([]);
  readonly toastItems = signal<ActivityItem[]>([]);
  readonly readActivityIds = signal<string[]>([]);
  readonly notificationMode = signal<NotificationMode>('all');
  readonly notificationCategory = signal('all');
  readonly sessionUser = signal<{ name: string; email: string } | null>(null);
  readonly nextRefreshInSeconds = signal(Math.floor(POLLING_INTERVAL_MS / 1000));

  readonly categories = computed(() => {
    const distinct = new Set<string>();
    this.allNews().forEach((item) => {
      if (item.category) {
        distinct.add(item.category);
      }
    });
    return ['all', ...Array.from(distinct).sort((a, b) => a.localeCompare(b))];
  });

  readonly precisions = computed(() => {
    const distinct = new Set<string>();
    this.allNews().forEach((item) => distinct.add(item.precision));
    return ['all', ...Array.from(distinct).sort((a, b) => a.localeCompare(b))];
  });

  readonly filteredNews = computed(() => {
    return this.allNews()
      .filter((item) => this.matchesFilters(item))
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  });

  readonly categorySummaries = computed(() => {
    const counts = new Map<string, number>();

    this.allNews().forEach((item) => {
      if (!this.matchesFilters(item, true)) {
        return;
      }

      const key = this.categoryKey(item.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: this.categoryLabel(key),
        count,
        color: this.categoryColor(key),
      }))
      .sort((a, b) => b.count - a.count);
  });

  readonly mapCircles = computed(() => {
    const buckets = new Map<string, MapCircle>();

    this.filteredNews().forEach((item) => {
      if (item.latitude === null || item.longitude === null) {
        return;
      }

      const key = item.locationName ?? this.coordinateKey(item.latitude, item.longitude);
      const existing = buckets.get(key);

      if (!existing) {
        buckets.set(key, {
          key,
          locationName: item.locationName ?? 'Unspecified location',
          latitude: item.latitude,
          longitude: item.longitude,
          count: 1,
          latestPublishedAt: item.publishedAt,
          articles: [item],
          primaryCategory: this.categoryKey(item.category),
        });
        return;
      }

      existing.count += 1;
      existing.articles.push(item);
      existing.primaryCategory = this.dominantCategory(existing.articles);
      if (Date.parse(item.publishedAt) > Date.parse(existing.latestPublishedAt)) {
        existing.latestPublishedAt = item.publishedAt;
      }
    });

    return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  });

  readonly featuredArticles = computed(() => this.filteredNews().slice(0, 60));
  readonly locationCount = computed(
    () => new Set(this.filteredNews().map((item) => item.locationName || 'unknown')).size,
  );
  readonly feedCountLabel = computed(() => `${this.featuredArticles().length} events`);
  readonly notificationCategories = computed(() => {
    const categories = new Set<string>();
    this.activityItems().forEach((item) => {
      if (item.category) {
        categories.add(this.categoryKey(item.category));
      }
    });
    return ['all', ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
  });
  readonly unreadActivityCount = computed(
    () => this.activityItems().filter((item) => !this.readActivityIds().includes(item.id)).length,
  );
  readonly filteredActivityItems = computed(() => {
    const mode = this.notificationMode();
    const category = this.notificationCategory();

    return this.activityItems().filter((item) => {
      const isRead = this.readActivityIds().includes(item.id);
      if (mode === 'unread' && isRead) {
        return false;
      }

      if (category !== 'all' && this.categoryKey(item.category) !== category) {
        return false;
      }

      return true;
    });
  });

  readonly timePresets = [1, 6, 12, 24, 48, 72];

  private map?: L.Map;
  private readonly circlesLayer = L.layerGroup();
  private readonly pulseLayer = L.layerGroup();
  private hasFittedBounds = false;

  private pollingSub?: Subscription;
  private countdownSub?: Subscription;
  private streamSub?: Subscription;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private readonly toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

  loginNameDraft = '';
  loginEmailDraft = '';

  constructor(private readonly newsApi: NewsApiService) {
    effect(() => {
      const circles = this.mapCircles();
      if (!this.map) {
        return;
      }
      this.renderMapCircles(circles);
    });
  }

  ngAfterViewInit(): void {
    this.restoreSession();
    this.initializeMap();
    this.fetchLatestNews();
    this.startPolling();
    this.startStream();
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
    this.countdownSub?.unsubscribe();
    this.streamSub?.unsubscribe();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.toastTimers.forEach((timerId) => clearTimeout(timerId));
    this.toastTimers.clear();
    this.map?.remove();
  }

  trackByNews = (_: number, item: NewsItem): string => `${item.source}-${item.sourceArticleId}`;
  trackByCategory = (_: number, category: CategorySummary): string => category.key;
  trackByActivity = (_: number, item: ActivityItem): string => item.id;

  jumpToFeed(): void {
    this.feedList?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

  focusCircle(circle: MapCircle): void {
    this.focusedCircleKey.set(circle.key);
    this.map?.flyTo([circle.latitude, circle.longitude], Math.max(this.map.getZoom(), 7), {
      animate: true,
      duration: 0.9,
    });
  }

  clearFocus(): void {
    this.focusedCircleKey.set(null);
    if (this.map && this.mapCircles().length > 0) {
      const bounds = L.latLngBounds(
        this.mapCircles().map((circle) => [circle.latitude, circle.longitude] as L.LatLngTuple),
      );
      this.map.fitBounds(bounds.pad(0.35));
    }
  }

  setCategory(categoryKey: string): void {
    this.selectedCategory.set(categoryKey === this.selectedCategory() ? 'all' : categoryKey);
  }

  setHoursBack(hours: number): void {
    this.hoursBack.set(hours);
  }

  cycleTimePreset(): void {
    const currentIndex = this.timePresets.indexOf(this.hoursBack());
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % this.timePresets.length;
    this.hoursBack.set(this.timePresets[nextIndex]);
  }

  toggleLegend(): void {
    this.legendVisible.update((visible) => !visible);
  }

  toggleNotifications(): void {
    this.isNotificationsOpen.update((open) => !open);
  }

  setNotificationMode(mode: NotificationMode): void {
    this.notificationMode.set(mode);
  }

  setNotificationCategory(category: string): void {
    this.notificationCategory.set(category);
  }

  isActivityRead(itemId: string): boolean {
    return this.readActivityIds().includes(itemId);
  }

  markActivityRead(itemId: string): void {
    if (this.readActivityIds().includes(itemId)) {
      return;
    }

    this.readActivityIds.update((ids) => [itemId, ...ids]);
  }

  markAllNotificationsRead(): void {
    const allIds = this.activityItems().map((item) => item.id);
    this.readActivityIds.set(Array.from(new Set(allIds)));
  }

  openLogin(): void {
    const currentUser = this.sessionUser();
    this.loginNameDraft = currentUser?.name ?? '';
    this.loginEmailDraft = currentUser?.email ?? '';
    this.isLoginOpen.set(true);
  }

  closeLogin(): void {
    this.isLoginOpen.set(false);
  }

  submitLogin(): void {
    const name = this.loginNameDraft.trim();
    const email = this.loginEmailDraft.trim();

    if (!name || !email) {
      return;
    }

    this.sessionUser.set({ name, email });
    this.persistSession();
    this.isLoginOpen.set(false);
  }

  logout(): void {
    this.sessionUser.set(null);
    this.loginNameDraft = '';
    this.loginEmailDraft = '';
    this.persistSession();
    this.isLoginOpen.set(false);
  }

  dismissActivity(itemId: string): void {
    this.activityItems.update((items) => items.filter((item) => item.id !== itemId));
    this.readActivityIds.update((ids) => ids.filter((id) => id !== itemId));
  }

  dismissToast(itemId: string): void {
    const timerId = this.toastTimers.get(itemId);
    if (timerId) {
      clearTimeout(timerId);
      this.toastTimers.delete(itemId);
    }
    this.toastItems.update((items) => items.filter((item) => item.id !== itemId));
  }

  relativeTime(timestamp: string): string {
    const deltaMs = Date.now() - Date.parse(timestamp);
    const hours = Math.max(0, Math.round(deltaMs / 3_600_000));

    if (hours < 1) {
      const minutes = Math.max(1, Math.round(deltaMs / 60_000));
      return `${minutes} min ago`;
    }

    if (hours < 24) {
      return `about ${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  categoryLabel(category: string | null | undefined): string {
    const key = this.categoryKey(category);
    if (key === 'ALL') {
      return 'All';
    }
    return key
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  categoryColor(category: string | null | undefined): string {
    return this.categoryVisual(category).circleStroke;
  }

  categoryTone(category: string | null | undefined): Record<string, string> {
    const color = this.categoryColor(category);
    return {
      '--accent': color,
      '--accent-soft': `${color}22`,
    };
  }

  private fetchLatestNews(): void {
    this.newsApi.listNews({ limit: 350 }).subscribe((response) => {
      const source = this.allNews().length === 0 ? 'bootstrap' : 'poll';
      const result = this.upsertNews(response.items);
      if (source !== 'bootstrap') {
        this.registerActivity(result.inserted, 'created');
      }
      this.lastSyncAt.set(new Date());
      this.resetRefreshCountdown();
    });
  }

  private startPolling(): void {
    this.resetRefreshCountdown();
    this.pollingSub = interval(POLLING_INTERVAL_MS).subscribe(() => this.fetchLatestNews());
    this.countdownSub = interval(1_000).subscribe(() => {
      this.nextRefreshInSeconds.update((seconds) => (seconds <= 0 ? 0 : seconds - 1));
    });
  }

  private startStream(): void {
    this.isStreaming.set(true);
    this.streamSub = this.newsApi.streamNews().subscribe({
      next: (event) => {
        const result = this.upsertNews([event.data]);
        if (result.inserted.length > 0) {
          this.registerActivity(result.inserted, 'created');
        } else if (event.eventType.endsWith('updated') && result.updated.length > 0) {
          this.registerActivity(result.updated, 'updated');
        }
        this.lastSyncAt.set(new Date());
      },
      complete: () => {
        this.isStreaming.set(false);
        this.reconnectTimer = setTimeout(() => this.startStream(), 5_000);
      },
    });
  }

  private upsertNews(incomingNews: NewsItem[]): UpsertResult {
    if (incomingNews.length === 0) {
      return { inserted: [], updated: [] };
    }

    const byKey = new Map<string, NewsItem>();
    const inserted: NewsItem[] = [];
    const updated: NewsItem[] = [];

    this.allNews().forEach((item) => {
      byKey.set(`${item.source}-${item.sourceArticleId}`, item);
    });

    incomingNews.forEach((item) => {
      const key = `${item.source}-${item.sourceArticleId}`;
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, item);
        inserted.push(item);
        return;
      }

      const existingUpdatedAt = Date.parse(existing.updatedAt);
      const incomingUpdatedAt = Date.parse(item.updatedAt);
      if (Number.isNaN(existingUpdatedAt) || incomingUpdatedAt >= existingUpdatedAt) {
        byKey.set(key, item);
        if (incomingUpdatedAt > existingUpdatedAt || Number.isNaN(existingUpdatedAt)) {
          updated.push(item);
        }
      }
    });

    this.allNews.set(Array.from(byKey.values()));
    return { inserted, updated };
  }

  private registerActivity(items: NewsItem[], type: 'created' | 'updated'): void {
    if (items.length === 0) {
      return;
    }

    const activity = items.map((item) => this.toActivityItem(item, type));

    this.activityItems.update((existing) => [...activity, ...existing].slice(0, 40));
    this.toastItems.update((existing) => [...activity, ...existing].slice(0, 4));

    activity.forEach((item) => {
      const timerId = setTimeout(() => this.dismissToast(item.id), 6000);
      this.toastTimers.set(item.id, timerId);
    });
  }

  private resetRefreshCountdown(): void {
    this.nextRefreshInSeconds.set(Math.floor(POLLING_INTERVAL_MS / 1000));
  }

  private toActivityItem(item: NewsItem, type: 'created' | 'updated'): ActivityItem {
    return {
      id: `${type}-${item.source}-${item.sourceArticleId}-${item.updatedAt}`,
      type,
      title: item.title,
      locationName: item.locationName,
      category: item.category,
      publishedAt: item.publishedAt,
      url: item.url,
      createdAt: new Date().toISOString(),
    };
  }

  private restoreSession(): void {
    const storedUser = globalThis.localStorage?.getItem('geonews-user-session');
    if (!storedUser) {
      return;
    }

    try {
      const parsed = JSON.parse(storedUser) as { name?: string; email?: string };
      if (parsed.name && parsed.email) {
        this.sessionUser.set({ name: parsed.name, email: parsed.email });
      }
    } catch {
      globalThis.localStorage?.removeItem('geonews-user-session');
    }
  }

  private persistSession(): void {
    const user = this.sessionUser();
    if (!user) {
      globalThis.localStorage?.removeItem('geonews-user-session');
      return;
    }

    globalThis.localStorage?.setItem('geonews-user-session', JSON.stringify(user));
  }

  private initializeMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 3,
      maxBoundsViscosity: 1,
    }).setView([43.8563, 18.4131], 6);

    this.map.setMaxBounds([
      [-85, -180],
      [85, 180],
    ]);

    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(this.map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 18,
      noWrap: true,
    }).addTo(this.map);

    this.circlesLayer.addTo(this.map);
    this.pulseLayer.addTo(this.map);
  }

  private renderMapCircles(circles: MapCircle[]): void {
    if (!this.map) {
      return;
    }

    this.circlesLayer.clearLayers();
    this.pulseLayer.clearLayers();

    circles.forEach((circle) => {
      const visual = this.categoryVisual(circle.primaryCategory);
      const radius = this.circleRadius(circle.count);

      const marker = L.circleMarker([circle.latitude, circle.longitude], {
        radius,
        color: visual.circleStroke,
        weight: 2,
        fillColor: visual.circleStroke,
        fillOpacity: 0.9,
      });

      marker.bindTooltip(`${circle.locationName} · ${circle.count} news`, {
        direction: 'top',
        offset: L.point(0, -10),
      });

      marker.on('click', () => {
        this.focusCircle(circle);
      });

      marker.addTo(this.circlesLayer);

      const pulseIcon = L.divIcon({
        className: 'geonews-pulse-pin',
        html: `<span class="geonews-pulse-shell" style="--pulse-ring:${visual.pulseRing};--pulse-core:${visual.pulseCore}"><span class="geonews-pulse-ring"></span><span class="geonews-pulse-core"></span></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      L.marker([circle.latitude, circle.longitude], {
        icon: pulseIcon,
        interactive: false,
      }).addTo(this.pulseLayer);
    });

    if (!this.hasFittedBounds && circles.length > 0) {
      const bounds = L.latLngBounds(
        circles.map((circle) => [circle.latitude, circle.longitude] as L.LatLngTuple),
      );
      this.map.fitBounds(bounds.pad(0.35));
      this.hasFittedBounds = true;
    }
  }

  private circleRadius(count: number): number {
    return Math.min(26, 7 + Math.sqrt(count) * 4.4);
  }

  private coordinateKey(latitude: number | null, longitude: number | null): string {
    if (latitude === null || longitude === null) {
      return 'unknown';
    }
    return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  }

  private categoryKey(category: string | null | undefined): string {
    return (category ?? 'General').trim().toUpperCase() || 'GENERAL';
  }

  private categoryVisual(category: string | null | undefined): CategoryVisual {
    const palette: Record<string, CategoryVisual> = {
      MILITARY: {
        circleStroke: '#ff6b6b',
        circleFill: '#ff6b6b',
        pulseRing: '#ff9b9b',
        pulseCore: '#ffe1e1',
      },
      EXPLOSION: {
        circleStroke: '#ff9f43',
        circleFill: '#ff9f43',
        pulseRing: '#ffd08a',
        pulseCore: '#fff1d6',
      },
      PROTEST: {
        circleStroke: '#facc15',
        circleFill: '#facc15',
        pulseRing: '#fde68a',
        pulseCore: '#fef9c3',
      },
      POLITICAL: {
        circleStroke: '#60a5fa',
        circleFill: '#60a5fa',
        pulseRing: '#93c5fd',
        pulseCore: '#dbeafe',
      },
      HUMANITARIAN: {
        circleStroke: '#4ade80',
        circleFill: '#4ade80',
        pulseRing: '#86efac',
        pulseCore: '#dcfce7',
      },
      CRIME: {
        circleStroke: '#c084fc',
        circleFill: '#c084fc',
        pulseRing: '#d8b4fe',
        pulseCore: '#f3e8ff',
      },
      INFRASTRUCTURE: {
        circleStroke: '#cbd5e1',
        circleFill: '#cbd5e1',
        pulseRing: '#e2e8f0',
        pulseCore: '#f8fafc',
      },
      MEDIA: {
        circleStroke: '#22d3ee',
        circleFill: '#22d3ee',
        pulseRing: '#67e8f9',
        pulseCore: '#cffafe',
      },
      GENERAL: {
        circleStroke: '#94a3b8',
        circleFill: '#94a3b8',
        pulseRing: '#cbd5e1',
        pulseCore: '#f8fafc',
      },
    };

    return palette[this.categoryKey(category)] ?? palette['GENERAL'];
  }

  private dominantCategory(items: NewsItem[]): string {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const key = this.categoryKey(item.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'GENERAL';
  }

  private matchesFilters(item: NewsItem, ignoreCategory = false): boolean {
    const category = this.selectedCategory();
    const precision = this.selectedPrecision();
    const query = this.searchQuery().toLowerCase().trim();
    const focusedKey = this.focusedCircleKey();
    const threshold = Date.now() - this.hoursBack() * 60 * 60 * 1000;

    if (!ignoreCategory && category !== 'all' && this.categoryKey(item.category) !== category) {
      return false;
    }

    if (precision !== 'all' && item.precision !== precision) {
      return false;
    }

    const published = Date.parse(item.publishedAt);
    if (!Number.isNaN(published) && published < threshold) {
      return false;
    }

    if (focusedKey) {
      const focusedLocation = item.locationName ?? this.coordinateKey(item.latitude, item.longitude);
      if (focusedLocation !== focusedKey) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    return [item.title, item.summary, item.locationName, item.category]
      .filter((value) => !!value)
      .join(' ')
      .toLowerCase()
      .includes(query);
  }
}
