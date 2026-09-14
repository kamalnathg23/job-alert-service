# Job Alert Service

A job alert system that ingests job listings, matches them to user alerts, and queues notifications.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env

# 3. Start infrastructure
docker compose up -d

# 4. Run migrations
./node_modules/.bin/prisma migrate dev

# 5. Start dev server
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs/ingest` | Ingest job listings |
| GET | `/api/jobs/search` | Search jobs (cached) |
| POST | `/api/alerts` | Create alert with AI parsing |
| POST | `/api/alerts/match` | Run matcher |
| POST | `/api/outbox` | Process notification outbox |

## Tech Stack

- Next.js 15, TypeScript, Prisma, PostgreSQL, Redis, Docker
