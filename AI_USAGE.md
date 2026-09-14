# AI Usage Disclosure

This document discloses all AI tool usage in this project per the assignment requirements.

## Tools Used

- **Claude (Anthropic)** — used for guidance, explanations, and code generation assistance

## What Was Generated With AI Assistance

| File | AI Role |
|------|---------|
| `prisma/schema.prisma` | Schema structure suggested, written manually |
| `app/api/jobs/ingest/route.ts` | Generated with AI assistance |
| `app/api/jobs/search/route.ts` | Generated with AI assistance |
| `app/api/alerts/route.ts` | Generated with AI assistance |
| `app/api/alerts/match/route.ts` | Generated with AI assistance |
| `app/api/outbox/route.ts` | Generated with AI assistance |
| `lib/ai/parser.ts` | Generated with AI assistance |
| `lib/cache/search.ts` | Generated with AI assistance |
| `docker-compose.yml` | Generated with AI assistance |
| `ARCHITECTURE.md` | Generated with AI assistance |

## What Was Written Manually (No AI)

Per the assignment's no-AI zone requirements, the following were written manually and understood line by line:

| File | Reason |
|------|--------|
| `lib/ingestion/hash.ts` | Core deterministic logic — no AI |
| `lib/ingestion/ingest.ts` | Core ingestion delta logic — no AI |
| `lib/matcher/normalize.ts` | Core matching logic — no AI |
| `lib/matcher/match.ts` | Core matching logic — no AI |
| `lib/outbox/worker.ts` | Core outbox retry logic — no AI |

## Verification

All AI-generated code was reviewed, understood, and tested before submission. The no-AI zone files were written manually with full understanding of every line.
