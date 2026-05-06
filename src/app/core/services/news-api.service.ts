import { Inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { API_BASE_URL } from '../config/api-base-url.token';
import { NewsItem, NewsListResponse, NewsStreamEvent } from '../models/news-item.model';

interface ListQuery {
  category?: string;
  location?: string;
  limit?: number;
  from?: string;
  to?: string;
}

const DUMMY_NEWS: NewsItem[] = [
  {
    id: 'dummy-001',
    source: 'klix',
    sourceArticleId: 'klix-001',
    title: 'Sarajevo gradonačelnik najavio nove projekte u centru grada',
    summary:
      'Gradska uprava Sarajeva predstavila je plan obnove pješačke zone, novih biciklističkih staza i proširenja zelenih površina u srcu grada. Radovi bi trebali početi u narednim mjesecima.',
    url: 'https://example.com/news/sarajevo-projects',
    category: 'POLITICAL',
    author: 'Mirza H.',
    imageUrl: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=900',
    publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    scrapedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    locationTagRaw: 'Sarajevo',
    locationName: 'Sarajevo',
    latitude: 43.8563,
    longitude: 18.4131,
    locationConfidence: 0.95,
    precision: 'city',
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'dummy-002',
    source: 'klix',
    sourceArticleId: 'klix-002',
    title: 'Banja Luka domaćin međunarodnog tehnološkog samita',
    summary:
      'Više od 500 stručnjaka iz cijelog regiona okupilo se u Banjoj Luci kako bi razgovarali o budućnosti vještačke inteligencije i digitalne ekonomije u Jugoistočnoj Evropi.',
    url: 'https://example.com/news/banjaluka-tech',
    category: 'MEDIA',
    author: 'Aleksandra P.',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=900',
    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    scrapedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    locationTagRaw: 'Banja Luka',
    locationName: 'Banja Luka',
    latitude: 44.7722,
    longitude: 17.191,
    locationConfidence: 0.92,
    precision: 'city',
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'dummy-003',
    source: 'klix',
    sourceArticleId: 'klix-003',
    title: 'Mostar: Završena obnova historijskog dijela grada',
    summary:
      'Nakon dvije godine radova, obnova starog dijela Mostara je završena. Otvoreno je nekoliko novih izložbenih prostora i kulturnih centara.',
    url: 'https://example.com/news/mostar-restoration',
    category: 'INFRASTRUCTURE',
    author: 'Edin S.',
    imageUrl: 'https://images.unsplash.com/photo-1605649461784-edc01e8d6f30?w=900',
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    scrapedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    locationTagRaw: 'Mostar',
    locationName: 'Mostar',
    latitude: 43.3438,
    longitude: 17.8078,
    locationConfidence: 0.97,
    precision: 'city',
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'dummy-004',
    source: 'klix',
    sourceArticleId: 'klix-004',
    title: 'Tuzla: Veliki protesti zbog kvaliteta zraka',
    summary:
      'Hiljade građana okupilo se u centru Tuzle zahtijevajući hitne mjere za poboljšanje kvaliteta zraka i smanjenje zagađenja iz industrijskih postrojenja.',
    url: 'https://example.com/news/tuzla-protest',
    category: 'PROTEST',
    author: 'Lejla K.',
    imageUrl: 'https://images.unsplash.com/photo-1591189824344-9f3c30af2c54?w=900',
    publishedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    scrapedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    locationTagRaw: 'Tuzla',
    locationName: 'Tuzla',
    latitude: 44.5384,
    longitude: 18.6739,
    locationConfidence: 0.9,
    precision: 'city',
    updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'dummy-005',
    source: 'klix',
    sourceArticleId: 'klix-005',
    title: 'Zenica: Nova fabrika otvara 300 radnih mjesta',
    summary:
      'Strani investitor zvanično je otvorio novu fabriku u industrijskoj zoni Zenice, čime se otvara više od 300 novih radnih mjesta u oblasti metalske industrije.',
    url: 'https://example.com/news/zenica-factory',
    category: 'INFRASTRUCTURE',
    author: 'Adnan B.',
    imageUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=900',
    publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    scrapedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    locationTagRaw: 'Zenica',
    locationName: 'Zenica',
    latitude: 44.2039,
    longitude: 17.9077,
    locationConfidence: 0.88,
    precision: 'city',
    updatedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'dummy-006',
    source: 'klix',
    sourceArticleId: 'klix-006',
    title: 'Bihać: Humanitarna akcija prikupila značajna sredstva',
    summary:
      'Lokalne organizacije u Bihaću organizovale su veliku humanitarnu akciju za pomoć ugroženim porodicama. Prikupljeno je više od 50.000 KM.',
    url: 'https://example.com/news/bihac-humanitarian',
    category: 'HUMANITARIAN',
    author: 'Selma D.',
    imageUrl: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=900',
    publishedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    scrapedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    locationTagRaw: 'Bihać',
    locationName: 'Bihać',
    latitude: 44.8167,
    longitude: 15.8708,
    locationConfidence: 0.93,
    precision: 'city',
    updatedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'dummy-007',
    source: 'klix',
    sourceArticleId: 'klix-007',
    title: 'Trebinje: Vinski festival privukao rekordan broj posjetilaca',
    summary:
      'Tradicionalni vinski festival u Trebinju ove godine je privukao više od 15.000 posjetilaca iz cijelog regiona. Predstavljeno je preko 40 vinskih kuća.',
    url: 'https://example.com/news/trebinje-wine',
    category: 'GENERAL',
    author: 'Marija J.',
    imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=900',
    publishedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    scrapedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    locationTagRaw: 'Trebinje',
    locationName: 'Trebinje',
    latitude: 42.7113,
    longitude: 18.3439,
    locationConfidence: 0.94,
    precision: 'city',
    updatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'dummy-008',
    source: 'klix',
    sourceArticleId: 'klix-008',
    title: 'Bijeljina: Policija razbila kriminalnu grupu',
    summary:
      'U koordinisanoj akciji policije u Bijeljini uhapšeno je sedam osoba zbog sumnje na organizovani kriminal. Zaplijenjena je značajna količina droge i oružja.',
    url: 'https://example.com/news/bijeljina-crime',
    category: 'CRIME',
    author: 'Vladimir N.',
    imageUrl: 'https://images.unsplash.com/photo-1453873623425-04e3f4ae9b29?w=900',
    publishedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    scrapedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    locationTagRaw: 'Bijeljina',
    locationName: 'Bijeljina',
    latitude: 44.7561,
    longitude: 19.2147,
    locationConfidence: 0.91,
    precision: 'city',
    updatedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
  },
];

@Injectable({
  providedIn: 'root',
})
export class NewsApiService {
  constructor(@Inject(API_BASE_URL) private readonly apiBaseUrl: string) {}

  getNewsById(id: string): Observable<NewsItem | null> {
    const match: NewsItem | undefined = DUMMY_NEWS.find((item) => item.id === id);
    return of(match ?? null).pipe(delay(150));
  }

  listNews(query: ListQuery = {}): Observable<NewsListResponse> {
    let items: NewsItem[] = [...DUMMY_NEWS];

    if (query.category) {
      items = items.filter((item) => item.category === query.category);
    }

    if (query.location) {
      items = items.filter((item) =>
        (item.locationName ?? '').toLowerCase().includes(query.location!.toLowerCase()),
      );
    }

    if (typeof query.limit === 'number' && query.limit > 0) {
      items = items.slice(0, query.limit);
    }

    return of({
      items,
      nextSince: null,
    }).pipe(delay(200));
  }

  streamNews(): Observable<NewsStreamEvent> {
    return new Observable<NewsStreamEvent>(() => {
      return () => undefined;
    });
  }
}
