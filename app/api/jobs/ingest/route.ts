import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestJobs } from "@/lib/ingestion/ingest";

// ── Request schema ────────────────────────────────────────────────────────────
const JobRecordSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  remote: z.boolean().default(false),
  skills: z.array(z.string()).default([]),
  observedAt: z.coerce.date().default(() => new Date()),
  sourceFileDate: z.coerce.date().optional(),
});

const IngestRequestSchema = z.object({
  jobs: z.array(JobRecordSchema).min(1).max(10_000),
});

// ── POST /api/jobs/ingest ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = IngestRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  try {
    const result = await ingestJobs(parsed.data.jobs);

    return NextResponse.json(
      {
        ok: true,
        batchId: result.batchId,
        counts: {
          total: result.total,
          new: result.new,
          contentChanged: result.contentChanged,
          freshnessOnly: result.freshnessOnly,
          unchanged: result.unchanged,
          rejected: result.rejected,
        },
        durationMs: result.durationMs,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[ingest] error", err);
    return NextResponse.json(
      { error: "Ingestion failed", message: String(err) },
      { status: 500 }
    );
  }
}