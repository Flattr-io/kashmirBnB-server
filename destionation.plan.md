# KashmirBNB Backend — Definitive Flow (Destinations → POIs → Weather)

This document specifies the exact backend flow and contracts to:

- Create Destinations with manual centers and polygons.
- Attach POIs to Destinations, with zoom-level visibility and priority for sponsored entities.
- Populate Weather by scheduled jobs using Destination centers, storing results in DB for fast reads.
- Query POIs and Weather by Destination ID without manually passing coordinates.

---

## Core Principles

- The Destination is the anchor entity. Its `id` links POIs and Weather.
- Destination center is entered manually (no centroid calculation).
- Client and services always pass `destination_id` to fetch POIs and Weather; the backend resolves coordinates internally.
- Weather is pre-fetched by jobs and stored in the database. Reads never hit third-party APIs directly.
- POI visibility is controlled by zoom thresholds and optional priority for sponsored entities.

---

## Data Model

### destinations (table)

```sql
- id UUID PK
- name VARCHAR(120) NOT NULL
- slug VARCHAR(140) UNIQUE NOT NULL
- area GEOMETRY(POLYGON, 4326) NOT NULL
- center GEOMETRY(POINT, 4326) NOT NULL
- center_lat DOUBLE PRECISION NOT NULL
- center_lng DOUBLE PRECISION NOT NULL
- metadata JSONB DEFAULT '{}'
- created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()
```

**Notes:**

- Center lat/lng are the single source for external integrations (weather). The geometry center mirrors these via triggers or RPC.
- Spatial indexes (GiST) on area and center. Trigram index on name.

### pois (table)

```sql
- id UUID PK
- destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE
- name VARCHAR(150) NOT NULL
- slug VARCHAR(160) UNIQUE NOT NULL
- location GEOMETRY(POINT, 4326) NOT NULL
- min_zoom INTEGER NOT NULL DEFAULT 12
- max_zoom INTEGER NOT NULL DEFAULT 22
- priority INTEGER NOT NULL DEFAULT 0
- category VARCHAR(60) NULL
- metadata JSONB DEFAULT '{}'
- created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()
```

**Notes:**

- GiST index on location; B-Tree index on destination_id, (priority DESC, min_zoom).

**Visibility Rules:**

- A POI is visible at zoom Z if: Z >= min_zoom AND Z <= max_zoom.
- Sponsored or high-priority POIs may set min_zoom lower (e.g., 8–10) to appear earlier (when zoomed out).

### destination_weather (table)

```sql
- id UUID PK
- destination_id UUID UNIQUE NOT NULL REFERENCES destinations(id) ON DELETE CASCADE
- provider VARCHAR(50) NOT NULL
- type VARCHAR(20) NOT NULL
- payload JSONB NOT NULL
- fetched_at TIMESTAMPTZ NOT NULL
- valid_until TIMESTAMPTZ NULL
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()
```

**Notes:**

- One row per destination per "type" can be enforced via unique index: (destination_id, type).
- Jobs overwrite the row to keep latest data. Read APIs only query this table, not external providers.

---

## API Contracts

### POST /destinations

Creates a destination. The center is set manually; no centroid computation.

**Request:**

```json
{
    "name": "Gulmarg",
    "slug": "gulmarg",
    "center_lat": 34.0485,
    "center_lng": 74.38,
    "area": {
        "type": "Polygon",
        "coordinates": [
            [
                [74.36, 34.03],
                [74.41, 34.03],
                [74.41, 34.06],
                [74.36, 34.06],
                [74.36, 34.03]
            ]
        ]
    },
    "metadata": {}
}
```

**Response 200:**

```json
{
    "id": "e7d7f1f4-2aa1-45b3-9a2e-7a3c2d1f9a99",
    "name": "Gulmarg",
    "slug": "gulmarg",
    "area": {
        "type": "Polygon",
        "coordinates": [
            [
                [74.36, 34.03],
                [74.41, 34.03],
                [74.41, 34.06],
                [74.36, 34.06],
                [74.36, 34.03]
            ]
        ]
    },
    "center": {
        "type": "Point",
        "coordinates": [74.38, 34.0485]
    },
    "center_lat": 34.0485,
    "center_lng": 74.38,
    "metadata": {},
    "created_by": null,
    "created_at": "2025-09-11T10:00:00.000Z",
    "updated_at": "2025-09-11T10:00:00.000Z"
}
```

### GET /destinations/:id

Retrieve a destination by id. Used to render polygon and map center.

**Response 200:**

```json
{
    "id": "e7d7f1f4-2aa1-45b3-9a2e-7a3c2d1f9a99",
    "name": "Gulmarg",
    "slug": "gulmarg",
    "area": {
        "type": "Polygon",
        "coordinates": [
            [
                [74.36, 34.03],
                [74.41, 34.03],
                [74.41, 34.06],
                [74.36, 34.06],
                [74.36, 34.03]
            ]
        ]
    },
    "center": {
        "type": "Point",
        "coordinates": [74.38, 34.0485]
    },
    "center_lat": 34.0485,
    "center_lng": 74.38,
    "metadata": {},
    "created_by": null,
    "created_at": "2025-09-11T10:00:00.000Z",
    "updated_at": "2025-09-11T10:00:00.000Z"
}
```

### POST /pois

Create a POI attached to a destination, with zoom visibility and priority.

**Request:**

```json
{
    "destination_id": "e7d7f1f4-2aa1-45b3-9a2e-7a3c2d1f9a99",
    "name": "Gulmarg Gondola",
    "slug": "gulmarg-gondola",
    "location": {
        "type": "Point",
        "coordinates": [74.38, 34.05]
    },
    "min_zoom": 11,
    "max_zoom": 22,
    "priority": 5,
    "category": "attraction",
    "metadata": {
        "ticket_required": true
    }
}
```

**Response 200:**

```json
{
    "id": "c2d83b6e-4f99-4b94-8a26-a4f2f6c55f6d",
    "destination_id": "e7d7f1f4-2aa1-45b3-9a2e-7a3c2d1f9a99",
    "name": "Gulmarg Gondola",
    "slug": "gulmarg-gondola",
    "location": {
        "type": "Point",
        "coordinates": [74.38, 34.05]
    },
    "min_zoom": 11,
    "max_zoom": 22,
    "priority": 5,
    "category": "attraction",
    "metadata": {
        "ticket_required": true
    },
    "created_at": "2025-09-11T10:05:00.000Z",
    "updated_at": "2025-09-11T10:05:00.000Z"
}
```

### GET /destinations/:id/pois

List POIs for a destination with visibility rules and optional filters.

Parameters:

- Required: `zoom` to apply visibility threshold (min_zoom/max_zoom)
- Optional: `bbox` to restrict to current map viewport
- Optional: `q` for simple search (name/slug/category)

**Response 200:**

```json
[
    {
        "id": "c2d83b6e-4f99-4b94-8a26-a4f2f6c55f6d",
        "destination_id": "e7d7f1f4-2aa1-45b3-9a2e-7a3c2d1f9a99",
        "name": "Gulmarg Gondola",
        "slug": "gulmarg-gondola",
        "location": {
            "type": "Point",
            "coordinates": [74.38, 34.05]
        },
        "min_zoom": 11,
        "max_zoom": 22,
        "priority": 5,
        "category": "attraction",
        "metadata": {
            "ticket_required": true
        },
        "created_at": "2025-09-11T10:05:00.000Z",
        "updated_at": "2025-09-11T10:05:00.000Z"
    }
]
```

# KashmirBNB Backend — Weather Flow (Destination-Centered, User Location Trigger)

This document defines the weather subsystem flow tailored to:

- Use manually defined Destination centers (no centroid calculations).
- Update weather for the Destination a user is currently within (polygon check on the backend).
- Read weather only from the database (populated by scheduled jobs), never directly from the provider at request-time.
- Use only the `destination_id` in client-to-backend calls; the backend resolves coordinates and data.

---

## Design Goals

- Deterministic anchoring: each Destination has a manually provided `center_lat`/`center_lng` used for all weather fetches.
- Polygon-aware UX: when a user’s current location enters a Destination polygon, the frontend requests weather for that Destination by id.
- DB-first reads: request handlers return weather from `destination_weather` (persisted by jobs), ensuring fast, reliable responses and no vendor dependency at runtime.
- Overwrite semantics: each weather refresh overwrites the previous row for the Destination and type (current/hourly/daily).

---

## Data Model (Weather)

### Table: `destination_weather`

- `id` UUID PK
- `destination_id` UUID UNIQUE NOT NULL REFERENCES `destinations(id)` ON DELETE CASCADE
- `type` VARCHAR(20) NOT NULL # "current" | "hourly" | "daily"
- `provider` VARCHAR(50) NOT NULL # e.g., "openweather", "visualcrossing", "open-meteo"
- `payload` JSONB NOT NULL # normalized, backend-owned schema
- `fetched_at` TIMESTAMPTZ NOT NULL # job fetch time
- `valid_until` TIMESTAMPTZ NULL # optional TTL
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()

Recommended index/constraint:

- UNIQUE (`destination_id`, `type`) — one active record per destination per type.

Payload normalization (example for `type = "current"`):

{
"summary": "Cloudy",
"icon": "cloudy",
"temperature": 12.4,
"feels_like": 10.8,
"humidity": 82,
"wind_speed": 3.1,
"precipitation": 0.2,
"pressure": 1016,
"visibility": 10.0,
"cloud_cover": 76,
"uv_index": 3
}

---

## Runtime Request Flow (Frontend → Backend)

1. Frontend determines user position (client-side geolocation).
2. Frontend requests the Destination that contains the user location (or already knows it from map/tap logic).
    - Either:
        - It already has the Destination from a polygon intersection performed on the backend (preferred), or
        - The frontend calls an endpoint like `GET /destinations/lookup?lng=...&lat=...` which returns the best-matching Destination id (backend runs `ST_Contains(area, point)`).
3. Frontend calls `GET /destinations/:id/weather?type=current|hourly|daily`.
4. Backend loads weather from `destination_weather` by `(destination_id, type)` and returns the normalized payload.
5. If no row exists yet (cold start), backend returns `404 Not Found` (or `204 No Content` per policy) to indicate data isn’t ready.

Key property: The frontend never sends lat/lng for weather requests — only `destination_id`. The backend resolves lat/lng from the Destination center internally for ingestion jobs.

---

## Scheduled Weather Ingestion Job (Backend)

Purpose: Keep `destination_weather` hot and consistent with the Destination's manual center.

Job cadence (configurable):

- `current`: every 10–15 minutes
- `hourly`: hourly
- `daily`: once per day

Job steps:

1. Fetch all Destination rows: `SELECT id, center_lat, center_lng FROM destinations`.
2. For each destination:

- Call external weather provider with `(center_lat, center_lng)` for the needed `type`.
- Normalize the provider's response to the internal `payload` schema.
- UPSERT into `destination_weather` with `(destination_id, type)` uniqueness:
    - `provider`, `payload`, `fetched_at = NOW()`, `valid_until` (optional TTL).

3. Commit overwrite so the latest is always served at read-time.

Notes:

- Overwrite semantics ensure consistent storage and trivial reads.
- Retry/backoff on provider errors to avoid partial updates; failed destinations can be logged and retried next cycle.

---

## API Endpoints (Weather)

### GET `/destinations/:id/weather`

Query parameters:

- `type` (required): `current` | `hourly` | `daily`

Behavior:

- Load `destination_weather` by `(destination_id = :id, type)`.
- If present and fresh (optional TTL), return payload.
- If missing/stale:
    - Return `404 Not Found` (explicit) or `204 No Content` (if you prefer silent no-data).
    - The job will populate/refresh on its schedule; synchronous provider calls are intentionally avoided.

Response example:

```json
{
    "destination_id": "e7d7f1f4-2aa1-45b3-9a2e-7a3c2d1f9a99",
    "type": "current",
    "provider": "openweather",
    "fetched_at": "2025-09-11T13:15:00.000Z",
    "valid_until": "2025-09-11T13:30:00.000Z",
    "payload": {
        "summary": "Cloudy",
        "icon": "cloudy",
        "temperature": 12.4,
        "feels_like": 10.8,
        "humidity": 82,
        "wind_speed": 3.1,
        "precipitation": 0.2,
        "pressure": 1016,
        "visibility": 10.0,
        "cloud_cover": 76,
        "uv_index": 3
    }
}
```

Errors:

- `404` — Destination not found or weather record missing.
- `400` — Invalid `type` query parameter.

---

## Destination Detection by User Location

While weather requests use only `destination_id`, the UX needs to map a user's current location to a Destination:

Option A (backend lookup endpoint):

- Endpoint: `GET /destinations/lookup?lng=<float>&lat=<float>`
- Backend performs: `ST_Contains(destinations.area, ST_SetSRID(ST_MakePoint(lng, lat), 4326))`
- Returns best match (or nearest fallback if outside any polygon, per product rules)
- Client then calls `/destinations/:id/weather?type=current`

Option B (map interaction-first):

- Client has already loaded Destinations and their polygons for the visible map area.
- Client chooses the active Destination id based on tap/selection.
- Client calls `/destinations/:id/weather?type=current`.

Both options keep weather reads by `destination_id` only.

---

## Consistency Guarantees

- Manual center: The only coordinates used for ingestion are `destinations.center_lat/center_lng`. This stays stable and curated.
- Overwrite on each job run: Latest weather replaces previous content. No historical retention is required for this flow (can be added later).
- No on-demand third-party calls in request path: Ensures predictable latency and avoids rate limits during traffic spikes.

---

## Example Frontend Sequence (User Enters a Destination Polygon)

1. Client gets user geolocation (lng, lat).
2. Client calls `GET /destinations/lookup?lng=...,lat=...` → receives `{ id: "<destination-uuid>", ... }`.
3. Client calls `GET /destinations/<id>/weather?type=current`.
4. Backend reads `destination_weather` and returns normalized weather.
5. On polygon exit/entry (user moves), repeat steps 2–4 to update the card.

---

## Future Extensions

- TTL-driven freshness: Enforce `valid_until` and fall back to the last known payload with a `stale: true` flag instead of 404.
- Historical retention: Store snapshots for analytics (in a separate table).
- Multi-provider blending: Backend job blends multiple sources (quality/bias reduction).
- Localization: Map icons and condition text to locale; units configurable (metric/imperial).

---
