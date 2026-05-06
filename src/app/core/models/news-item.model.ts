export interface NewsItem {
  id: string;
  source: string;
  sourceArticleId: string;
  title: string;
  summary: string;
  url: string;
  category: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: string;
  scrapedAt: string | null;
  locationTagRaw: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  locationConfidence: number;
  precision: string;
  updatedAt: string;
}

export interface NewsListResponse {
  items: NewsItem[];
  nextSince: string | null;
}

export interface NewsStreamEvent {
  eventType: string;
  emittedAt: string;
  data: NewsItem;
}
