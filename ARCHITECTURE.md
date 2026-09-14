# Architecture

## Overview

Job Alert Service is a Next.js application that lets users save job alert preferences, ingests job listings from external feeds, matches jobs to alerts using deterministic logic, and queues notifications via a transactional outbox.

## System Components

### 1. Ingestion Engine (`lib/ingestion/`)

Jobs arrive in bulk via `POST /api/jobs/ingest`. The engine uses a **staging table → set-based merge** approach:

1. Validate and hash each incoming record (`computeContentHash`)
2. Bulk-insert valid records into `JobStaging` with a shared `ingestBatchId`
3. Run three SQL operations inside one transaction:
   - **INSERT** records where `sourceId` does not exist in `Job`
   - **UPDATE** records where `sourceId` exists and `contentHash` differs (content changed)
   - **UPDATE** only `observedAt`/`sourceFileDate` where `contentHash` is identical (freshness-only)
4. Delete staging rows for this batch
5. Return per-category counts: `new`, `contentChanged`, `freshnessOnly`, `unchanged`, `rejected`

This approach avoids N+1 queries. A batch of 10,000 jobs requires exactly 4 SQL statements regardless of size.

`contentHash` is a SHA-256 of normalized stable fields (title, company, description, location, remote, sorted skills). Volatile fields (observedAt, sourceFileDate) are excluded so timestamp updates don't trigger content-changed events.

### 2. Deterministic Matcher (`lib/matcher/`)

The matcher runs via `POST /api/alerts/match`. It is **entirely deterministic — no AI or LLM in the matching loop**.

For each alert-job pair, the matcher checks in order:

1. **Exclude terms** — if any excluded term appears in job text, immediately reject
2. **Role matching** — at least one alert role must appear in job title/description
3. **Skills matching** — at least one alert skill must appear in job skills array or description
4. **Location matching** — job location must contain an alert location, or job is remote and alert allows remote
5. **Remote preference** — if alert requires remote, job must be remote

Each passed check adds to a `score` integer and appends a human-readable string to `reasons[]`. Matches are written to `JobMatch` with a `@@unique([alertId, jobId])` constraint as the dedup guard.

### 3. AI Parser (`lib/ai/parser.ts`)

Used once per alert creation — parses the user's natural language text into structured filters.

- Default provider: `fake` (keyword extraction, no API call)
- Real provider: configurable via `LLM_PROVIDER` env variable
- Output validated with Zod before saving to DB
- `parseFallback` field records whether the AI failed and a fallback was used
- `promptVersion` records which provider/version was used

The AI parser is **never called during matching** — only during alert creation.

### 4. Cache Layer (`lib/cache/search.ts`)

Job search uses a **cache-aside pattern** with Redis:

1. Check Redis for cached result → return immediately on hit
2. **Single-flight protection**: if the same query is already in-flight to Postgres, wait for that promise instead of firing a duplicate query
3. Fetch from Postgres on miss, write to Redis with 60-second TTL
4. If Redis is unavailable, `redisAvailable` flag is set to false and all requests go directly to Postgres — no timeouts, no crashes

Redis failures are handled gracefully via an `on("error")` handler that flips the circuit breaker flag.

### 5. Notification Outbox (`lib/outbox/worker.ts`)

After matching, matched job IDs are written to `NotificationOutbox` as `pending`. A worker processes the outbox in batches:

1. Fetch up to 50 `pending` records with `attempts < 3`
2. Mark all as `processing` atomically (prevents duplicate processing)
3. For each record: attempt send → mark `sent` on success, retry or permanently `failed` on error
4. `processedAt` timestamp recorded on final state

The `@@unique([alertId, jobId])` constraint on `JobMatch` ensures the same alert-job pair is never queued twice.

## Database Schema

| Table | Purpose |
|-------|---------|
| `Alert` | User job alert with parsed filters |
| `Job` | Canonical job listings with content hash |
| `JobStaging` | Temporary ingest buffer, cleared after each batch |
| `JobMatch` | Matched alert-job pairs with score and reasons |
| `NotificationOutbox` | Transactional outbox for digest notifications |

GIN indexes on `Job.skills`, `Alert.skills`, and `Alert.roles` enable efficient array-contains queries at scale.

## Data Flow

```
POST /api/jobs/ingest
  → validate + hash
  → bulk insert JobStaging
  → set-based SQL merge → Job
  → return delta counts

POST /api/alerts (create alert)
  → AI parser (fake/real)
  → validate with Zod
  → save Alert

POST /api/alerts/match
  → load all alerts + jobs
  → deterministic match loop
  → upsert JobMatch
  → queue NotificationOutbox

GET /api/jobs/search
  → Redis cache hit → return
  → single-flight → Postgres
  → write to Redis (60s TTL)

POST /api/outbox
  → fetch pending batch (50)
  → mark processing
  → send notifications
  → mark sent/failed
```

## Infrastructure

- **PostgreSQL 15** — primary data store
- **Redis 7** — search result cache with graceful degradation
- **Docker Compose** — local development environment
- **Next.js 15 App Router** — API routes and frontend
- **Prisma ORM** — schema management and migrations

## Design Decisions

**Why staging table?** Enables set-based delta detection without loading each record into application memory. Scales to 10k+ records per batch with constant SQL statement count.

**Why no AI in the matcher?** Deterministic matching is faster, cheaper, auditable, and testable. AI is expensive and non-deterministic — using it in a hot loop that runs against 150k alerts would be impractical.

**Why cache-aside over read-through?** Cache-aside gives explicit control over invalidation. After ingesting new jobs, `invalidateSearchCache()` clears stale results immediately.

**Why transactional outbox?** Prevents lost notifications if the process crashes after matching but before sending. The outbox survives restarts and retries failed sends up to 3 times.
