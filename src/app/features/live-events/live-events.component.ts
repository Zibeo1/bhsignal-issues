import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { NewsItem } from '../../core/models/news-item.model';
import { NewsApiService } from '../../core/services/news-api.service';

interface LiveEvent {
  id: string;
  eventType: string;
  receivedAt: string;
  data: NewsItem;
}

@Component({
  selector: 'app-live-events',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './live-events.component.html',
  styleUrl: './live-events.component.css',
})
export class LiveEventsComponent implements OnInit, OnDestroy {
  readonly events = signal<LiveEvent[]>([]);
  readonly connected = signal<boolean>(false);
  readonly eventCount = signal<number>(0);

  private streamSub?: Subscription;

  constructor(private readonly newsApi: NewsApiService) {}

  ngOnInit(): void {
    this.connect();
  }

  ngOnDestroy(): void {
    this.streamSub?.unsubscribe();
  }

  connect(): void {
    this.connected.set(true);
    this.streamSub = this.newsApi.streamNews().subscribe({
      next: (event) => {
        this.eventCount.update((n) => n + 1);
        const liveEvent: LiveEvent = {
          id: `${event.eventType}-${event.emittedAt}-${event.data.id}`,
          eventType: event.eventType,
          receivedAt: new Date().toISOString(),
          data: event.data,
        };
        this.events.update((current) => [liveEvent, ...current].slice(0, 50));
      },
      complete: () => {
        this.connected.set(false);
      },
    });
  }

  disconnect(): void {
    this.streamSub?.unsubscribe();
    this.connected.set(false);
  }

  clearEvents(): void {
    this.events.set([]);
    this.eventCount.set(0);
  }

  formatEventType(type: string): string {
    if (type.endsWith('created')) return 'NEW';
    if (type.endsWith('updated')) return 'UPDATED';
    return type.toUpperCase();
  }

  relativeTime(timestamp: string): string {
    const deltaMs = Date.now() - Date.parse(timestamp);
    if (deltaMs < 60_000) return `${Math.round(deltaMs / 1000)}s ago`;
    const minutes = Math.round(deltaMs / 60_000);
    return `${minutes}m ago`;
  }
}
