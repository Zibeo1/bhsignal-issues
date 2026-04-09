# BHSignal

> A real-time geolocation news platform that is mainly oriented for Bosnia and Herzegovina. A web scraper ingests articles from **klix.ba**, resolves each article to a geographic location, and pushes events to a Spring Boot integration API via signed webhooks. The Angular frontend attaches to a live SSE stream and renders each news cluster as a pulsating circle on an interactive Leaflet map. The more news that location has the bigger circle will be displayed when zoomed out to se the entire map.

---


## Team & Feature Ownership

Here are all issues that are delegated for us 3 to do.

| Member | Features |
|--------|----------|
| Amar | Scraper service · Location resolution |
| Mirza | Integration API · SSE live stream |
| Ahmed | Map dashboard · Filtering & notifications |

---

## Features

### Feature 1 — Klix RSS Scraper

**Owner:** Amar Selmanovic

**Description**
A scheduled FastAPI service fetches the Klix.ba RSS feed every 5 minutes (configurable). Each entry is parsed and normalised: HTML is stripped, the article ID is extracted from the URL, publication date is converted to UTC, and author/category/image fields are mapped. New articles are inserted into the scraper database; existing articles are updated only when their content changes. Every create or update event is atomically enqueued into an outbox table in the same database transaction.


### Feature 2 — Location Resolution

**Owner:** Amar Selmanovic

**Description**
After parsing each RSS entry, the scraper resolves a geographic location by matching the article title, summary, and category against a local JSON catalog of cities, countries, and regions. Matching uses diacritics-normalised alias lookup with word-boundary guards. Confidence is scored: a title hit contributes 0.65, a summary hit 0.25, a category hit 0.10. When no alias matches, a category fallback maps known category slugs (e.g. `BiH` → Bosnia and Herzegovina, `Regija` → Balkans, `Svijet` → World). Unresolvable articles receive `precision: unknown` and null coordinates — they are stored but not rendered on the map.


### Feature 3 — Webhook Delivery with Outbox & Retry

**Owner:** Mirza Hadzovic

**Description**
The outbox dispatcher runs every 20 seconds as a background job. It selects `pending` and `failed` events where `next_retry_at <= now` and `attempts < max_attempts`, then POSTs each to the integration API. Each request carries `Content-Type: application/json`, `X-Event-Id` (the outbox event UUID), and `X-Signature-256` (HMAC-SHA256 of the raw JSON body using the shared secret). On success the event is marked `delivered`. On failure, backoff is `retry_base_seconds × 2^(attempts-1)`; after `max_attempts` the event is permanently marked `failed` and remains queryable.


### Feature 4 — Integration API (Webhook Intake & News Query)

**Owner:** Mirza Hadzovic

**Description**
A Spring Boot 3 service (Java 21) that receives signed webhook events from the scraper, validates the HMAC-SHA256 signature, enforces idempotency via a `processed_events` table keyed on `X-Event-Id`, and upserts the news item into `news_items`. After saving, it immediately broadcasts the event to all active SSE clients. The news query endpoint supports filtering by bounding box, time range, category, and location name using JPA Specification queries ordered by `publishedAt` descending. Default data store is H2 (file-backed, PostgreSQL compatibility mode) for local development; switch to Postgres via environment variables.



### Feature 5 — Live Map Dashboard

**Owner:** Ahmed Senderovic

**Description**
The Angular `MapDashboardComponent` initialises a Leaflet map centred on Bosnia and Herzegovina using the CartoDB dark tile layer. Articles are grouped into location buckets by `locationName`. Each bucket is rendered as a `circleMarker` whose radius scales with article count (`7 + √count × 4.4`, capped at 26px), colour-coded by dominant category using a fixed category palette (MILITARY, CRIME, POLITICAL, HUMANITARIAN, etc.). A CSS-animated `divIcon` overlays a pulsating ring on each circle. The map auto-fits to all marker bounds on first load. SSE events from `/api/v1/stream/news` are merged into the in-memory article store in real time. If the SSE connection drops, the client reconnects after 5 seconds. A polling fallback re-fetches every 45 seconds regardless of SSE state.



### Feature 6 — Filtering, Search & Notifications

**Owner:** Ahmed Senderovic

**Description**
The dashboard exposes category chip filters, a precision dropdown, a headline/location free-text search field, and a time-window selector (1h / 6h / 12h / 24h / 48h / 72h). All filters compose through a single `filteredNews` computed signal that drives both the map markers and the feed panel simultaneously. Incoming SSE events are promoted to a notification drawer (capped at 40 items) and a toast stack (capped at 4, auto-dismissed after 6 seconds). The notification drawer supports all/unread mode and per-category filtering. A local session (name + email) is persisted to `localStorage` and displayed in the navbar.


## Architecture

```
┌──────────────────────┐          webhook            ┌──────────────────────────┐
│   scraper-service    │ ──────────────────────────► │   integration-api         │
│   Python / FastAPI   │                             │   Spring Boot / Java 21   │
│                      │                             │                           │
│  Klix RSS fetch      │                             │  Signature verification   │
│  Location resolver   │                             │  Idempotency (event ID)   │
│  Outbox + retry      │                             │  News query API           │
│  SQLite / Postgres   │                             │  SSE broadcast            │
└──────────────────────┘                             │  H2 / Postgres            │
                                                     └────────────┬──────────────┘
                                                                  │  SSE + polling
                                                                  ▼
                                                     ┌──────────────────────────┐
                                                     │   web-frontend            │
                                                     │   Angular 21 + Leaflet    │
                                                     │                           │
                                                     │  Pulsating map circles    │
                                                     │  Category filters         │
                                                     │  Notification drawer      │
                                                     │  Toast stack              │
                                                     └──────────────────────────┘
```

**Data flow**

1. Scraper pulls `https://www.klix.ba/rss` every 5 minutes.
2. Each entry is location-resolved and stored in the scraper database.
3. An outbox event is written atomically in the same transaction.
4. The outbox dispatcher POSTs a signed webhook to the integration API every 20 seconds.
5. Integration API verifies the signature, deduplicates by event ID, and upserts the news item.
6. The saved item is immediately broadcast to all connected SSE clients.
7. The frontend merges the SSE event into its in-memory store and re-renders map circles.


## Tests

```bash
cd services/scraper-service
pytest

# Individual suites
pytest tests/test_klix_rss_client.py      # RSS parsing and article ID extraction
pytest tests/test_location_resolver.py    # Location matching and category fallback
pytest tests/test_scraper_service.py      # Insert, dedupe, and outbox enqueue
```

### Manual webhook test

```bash
# Terminal 1 — mock receiver on port 8090
python3 services/scraper-service/tools/mock_webhook_receiver.py

# Terminal 2 — scraper pointed at the mock
export WEBHOOK_TARGET_URL=http://127.0.0.1:8090/api/v1/webhooks/news
export WEBHOOK_SECRET=local-secret
uvicorn app.main:app --reload --port 8081
curl -X POST http://localhost:8081/api/v1/scrape/run
curl -X POST http://localhost:8081/api/v1/outbox/dispatch
```

---

## Webhook Contract

`POST /api/v1/webhooks/news`

**Headers**
```
Content-Type: application/json
X-Event-Id: <uuid>
X-Signature-256: sha256=<hex-hmac-sha256-of-raw-body>
```

**Body**
```json
{
  "eventType": "news.created",
  "occurredAt": "2026-04-09T12:00:00Z",
  "source": "klix-scraper",
  "data": {
    "source": "klix",
    "sourceArticleId": "260409001",
    "title": "Sjednica odrzana u Sarajevu",
    "summary": "Razgovaralo se o javnom prevozu.",
    "url": "https://www.klix.ba/vijesti/bih/.../260409001",
    "publishedAt": "2026-04-09T11:45:00Z",
    "category": "BiH",
    "author": "D. R.",
    "imageUrl": "https://static.klix.ba/media/...",
    "locationTagRaw": "sarajevu",
    "locationName": "Sarajevo",
    "latitude": 43.8563,
    "longitude": 18.4131,
    "locationConfidence": 0.95,
    "precision": "city",
    "updatedAt": "2026-04-09T12:00:00Z"
  }
}
```

**Responses**

| Status | Meaning |
|--------|---------|
| `202 Accepted` | Event ingested and broadcast to SSE clients |
| `200 OK` | Duplicate `X-Event-Id` — already processed |
| `400 Bad Request` | Missing `X-Event-Id` or malformed payload |
| `403 Forbidden` | Signature verification failed |

---

## Known Limitations

- **Crna Hronika** scraping is not yet implemented — only klix.ba RSS is ingested.
- **Location catalog** covers 20 entries; articles from unlisted locations are stored with `precision: unknown` and are not shown on the map.

We will work on implementing fixes for these limitations.

---

*BHSignal — Homework #1, Spring 2026*

---

## Site Map

BHSignal is a single-page Angular application. There is one real route (`/`); all `**` paths redirect back to it. What the brief calls "pages" are panels, overlays, and drawers within the single shell:

```
/ (MapDashboardComponent)
│
├── Map panel
│   ├── Pulsating circle markers (one per location bucket)
│   ├── Live countdown overlay (refresh in Ns)
│   ├── Focus chips (top 8 locations)
│   └── Timeline bar (1h / 6h / 12h / 24h / 48h / 72h presets)
│
├── Feed panel (right sidebar)
│   ├── Category chip filters
│   ├── Search field + precision dropdown
│   └── Scrollable article list (up to 60 items)
│
├── Notification drawer (overlay, toggled)
│   ├── All / Unread mode toggle
│   ├── Category filter dropdown
│   ├── Activity item list (capped at 40)
│   └── Toast stack (capped at 4, auto-dismiss 6s)
│
└── Login modal (overlay, toggled)
    ├── Name + email fields
    ├── Save session → localStorage
    └── Log out
```

---

## Mockups

Mockups for all screens are attached to each GitHub issue. 
---

## API Documentation

### Scraper service — `http://localhost:8081`

---

#### `GET /health`

Service health and scheduler status.

**Response `200 OK`**
```json
{ "status": "ok", "service": "klix-scraper-service", "schedulerRunning": true }
```

---

#### `GET /api/v1/news`

List articles with optional filters, ordered by `published_at` descending.

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `since` | ISO datetime | — | Only articles published at or after this time |
| `category` | string | — | Case-insensitive exact match on category |
| `location` | string | — | Partial case-insensitive match on `location_name` |
| `limit` | int 1–500 | 100 | Maximum results |

**Response `200 OK`**
```json
{
  "items": [
    {
      "id": "3f8a1b2c-d4e5-...",
      "source": "klix",
      "source_article_id": "260409001",
      "title": "Policija uhapsila osumnjičenog u Sarajevu",
      "summary": "Prema informacijama...",
      "url": "https://www.klix.ba/vijesti/bih/.../260409001",
      "category": "BiH",
      "author": "D. R.",
      "image_url": "https://static.klix.ba/media/...",
      "published_at": "2026-04-09T11:45:00Z",
      "scraped_at": "2026-04-09T11:47:02Z",
      "location_tag_raw": "sarajevu",
      "location_name": "Sarajevo",
      "latitude": 43.8563,
      "longitude": 18.4131,
      "location_confidence": 0.95,
      "precision": "city",
      "created_at": "2026-04-09T11:47:02Z",
      "updated_at": "2026-04-09T11:47:02Z"
    }
  ],
  "next_since": "2026-04-09T11:45:00Z"
}
```

---

#### `GET /api/v1/news/{article_id}`

Single article by scraper UUID.

**Response `200 OK`** — same shape as one item above.
**Response `404 Not Found`** — `{"detail": "Article not found"}`

---

#### `POST /api/v1/scrape/run`

Trigger an immediate scrape run and outbox dispatch.

**Request body** (optional)
```json
{ "limit": 50 }
```

**Response `200 OK`**
```json
{ "fetched": 42, "inserted": 3, "updated": 1, "skipped": 38, "outbox_enqueued": 4 }
```

---

#### `GET /api/v1/outbox/status`

Outbox event counts grouped by delivery status.

**Response `200 OK`**
```json
{ "pending": 2, "failed": 0, "delivered": 194 }
```

---

#### `POST /api/v1/outbox/dispatch`

Manually flush pending webhook events to the integration API.

**Response `200 OK`**
```json
{ "delivered": 2, "failed": 0, "retried": 0 }
```

---

### Integration API — `http://localhost:8080`

---

#### `POST /api/v1/webhooks/news`

Receive a signed event from the scraper. Validates HMAC signature and enforces idempotency by `X-Event-Id`. Upserts the news item and broadcasts to all connected SSE clients.

**Required headers**

| Header | Description |
|--------|-------------|
| `X-Event-Id` | Outbox event UUID — used for idempotency check |
| `X-Signature-256` | `sha256=<HMAC-SHA256 of raw request body>` using the shared secret |

**Request body**
```json
{
  "eventType": "news.created",
  "occurredAt": "2026-04-09T12:00:00Z",
  "source": "klix-scraper",
  "data": {
    "source": "klix",
    "sourceArticleId": "260409001",
    "title": "Policija uhapsila osumnjičenog u Sarajevu",
    "summary": "Prema informacijama...",
    "url": "https://www.klix.ba/...",
    "publishedAt": "2026-04-09T11:45:00Z",
    "category": "BiH",
    "author": "D. R.",
    "imageUrl": "https://static.klix.ba/...",
    "locationTagRaw": "sarajevu",
    "locationName": "Sarajevo",
    "latitude": 43.8563,
    "longitude": 18.4131,
    "locationConfidence": 0.95,
    "precision": "city",
    "updatedAt": "2026-04-09T12:00:00Z"
  }
}
```

**Responses**

| Status | Meaning |
|--------|---------|
| `202 Accepted` | Ingested, upserted, and broadcast to SSE clients |
| `200 OK` | `{"status":"duplicate"}` — `X-Event-Id` already processed |
| `400 Bad Request` | Missing `X-Event-Id` or malformed JSON |
| `403 Forbidden` | HMAC signature mismatch or missing `X-Signature-256` |

---

#### `GET /api/v1/news`

Query stored news items with filtering and pagination.

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bbox` | string | — | `minLon,minLat,maxLon,maxLat` — filters by coordinate bounding box |
| `from` | ISO datetime | — | `publishedAt >= from` |
| `to` | ISO datetime | — | `publishedAt <= to` |
| `category` | string | — | Case-insensitive exact match |
| `location` | string | — | Partial match on `locationName` |
| `limit` | int 1–500 | 100 | Max results, ordered by `publishedAt` desc |

**Response `200 OK`**
```json
{
  "items": [
    {
      "id": "uuid",
      "source": "klix",
      "sourceArticleId": "260409001",
      "title": "Policija uhapsila osumnjičenog u Sarajevu",
      "summary": "...",
      "url": "https://www.klix.ba/...",
      "category": "BiH",
      "author": "D. R.",
      "imageUrl": "...",
      "publishedAt": "2026-04-09T11:45:00Z",
      "locationTagRaw": "sarajevu",
      "locationName": "Sarajevo",
      "latitude": 43.8563,
      "longitude": 18.4131,
      "locationConfidence": 0.95,
      "precision": "city",
      "updatedAt": "2026-04-09T12:00:00Z"
    }
  ],
  "nextSince": "2026-04-09T11:45:00Z"
}
```

---

#### `GET /api/v1/news/{id}`

Single news item by integration API UUID.

**Response `200 OK`** — same shape as one item above.
**Response `404 Not Found`** — `{"message": "News item not found"}`

---

#### `GET /api/v1/stream/news`

Server-Sent Events stream. Long-lived connection; the server pushes events as articles are ingested.

**Response headers**
```
Content-Type: text/event-stream
```

**Event stream format**
```
event: stream.ready
data: {"eventType":"stream.ready","emittedAt":"2026-04-09T12:00:00Z","data":null}

event: news.created
data: {"eventType":"news.created","emittedAt":"2026-04-09T12:01:05Z","data":{...NewsResponse...}}

event: news.updated
data: {"eventType":"news.updated","emittedAt":"2026-04-09T12:05:11Z","data":{...NewsResponse...}}
```

The frontend (`NewsApiService.streamNews()`) listens on `onmessage`, `news.created`, and `news.updated` events and reconnects automatically after 5 seconds on disconnect.

---

*BHSignal — Homework #1, Spring 2026*
