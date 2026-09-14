import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { computeContentHash } from "./hash";

const prisma = new PrismaClient();

export interface RawJobRecord {
  sourceId: string;
  title: string;
  company: string;
  description: string;
  location: string;
  remote: boolean;
  skills: string[];
  observedAt: Date;
  sourceFileDate?: Date;
}

export interface IngestResult {
  batchId: string;
  total: number;
  new: number;
  contentChanged: number;
  freshnessOnly: number;
  unchanged: number;
  rejected: number;
  durationMs: number;
}

/**
 * Ingests a batch of raw job records using a staging → merge approach.
 *
 * Flow:
 * 1. Validate and hash each record → collect rejected
 * 2. Bulk-insert valid records into JobStaging
 * 3. Run a single set-based SQL merge against Job
 * 4. Clean up staging rows for this batch
 * 5. Return per-category counts
 *
 * NO LLM is used here. NO per-record round-trips.
 */
export async function ingestJobs(
  records: RawJobRecord[]
): Promise<IngestResult> {
  const startMs = Date.now();
  const batchId = randomUUID();
  let rejected = 0;

  // ── Step 1: Validate + hash ──────────────────────────────────────────────
  const valid: Array<RawJobRecord & { contentHash: string }> = [];

  for (const rec of records) {
    if (!rec.sourceId?.trim() || !rec.title?.trim() || !rec.company?.trim()) {
      rejected++;
      continue;
    }
    valid.push({
      ...rec,
      contentHash: computeContentHash(rec),
    });
  }

  if (valid.length === 0) {
    return {
      batchId,
      total: records.length,
      new: 0,
      contentChanged: 0,
      freshnessOnly: 0,
      unchanged: 0,
      rejected,
      durationMs: Date.now() - startMs,
    };
  }

  // ── Step 2: Bulk-insert into staging ─────────────────────────────────────
  // createMany is a single multi-row INSERT — not N round-trips
  await prisma.jobStaging.createMany({
    data: valid.map((r) => ({
      sourceId: r.sourceId,
      title: r.title,
      company: r.company,
      description: r.description,
      location: r.location,
      remote: r.remote,
      skills: r.skills,
      contentHash: r.contentHash,
      observedAt: r.observedAt,
      sourceFileDate: r.sourceFileDate ?? null,
      ingestBatchId: batchId,
    })),
  });

  // ── Step 3: Set-based merge via raw SQL ───────────────────────────────────
  //
  // Categories:
  //   NEW           — sourceId not in Job at all
  //   CONTENT_CHANGED — sourceId exists, contentHash differs
  //   FRESHNESS_ONLY  — sourceId exists, contentHash same, observedAt newer
  //   UNCHANGED       — sourceId exists, contentHash same, observedAt not newer
  //
  // We do this in one transaction with three SQL statements:
  //   a) INSERT new jobs
  //   b) UPDATE content-changed jobs (rewrites stable + freshness fields)
  //   c) UPDATE freshness-only jobs (rewrites ONLY observedAt/sourceFileDate)

  const mergeResult = await prisma.$transaction(async (tx) => {
    // a) Insert brand-new jobs
    const inserted = await tx.$executeRaw`
      INSERT INTO "Job" (
        "id", "sourceId", "title", "company", "description",
        "location", "remote", "skills", "contentHash",
        "observedAt", "sourceFileDate", "createdAt", "updatedAt"
      )
      SELECT
        gen_random_uuid()::text,
        s."sourceId", s."title", s."company", s."description",
        s."location", s."remote", s."skills", s."contentHash",
        s."observedAt", s."sourceFileDate", NOW(), NOW()
      FROM "JobStaging" s
      WHERE s."ingestBatchId" = ${batchId}
        AND NOT EXISTS (
          SELECT 1 FROM "Job" j WHERE j."sourceId" = s."sourceId"
        )
    `;

    // b) Update jobs where stable content changed
    const contentUpdated = await tx.$executeRaw`
      UPDATE "Job" j
      SET
        "title"          = s."title",
        "company"        = s."company",
        "description"    = s."description",
        "location"       = s."location",
        "remote"         = s."remote",
        "skills"         = s."skills",
        "contentHash"    = s."contentHash",
        "observedAt"     = s."observedAt",
        "sourceFileDate" = s."sourceFileDate",
        "updatedAt"      = NOW()
      FROM "JobStaging" s
      WHERE s."ingestBatchId" = ${batchId}
        AND j."sourceId"    = s."sourceId"
        AND j."contentHash" != s."contentHash"
    `;

    // c) Update ONLY freshness fields when stable content is identical
    const freshnessUpdated = await tx.$executeRaw`
      UPDATE "Job" j
      SET
        "observedAt"     = s."observedAt",
        "sourceFileDate" = s."sourceFileDate",
        "updatedAt"      = NOW()
      FROM "JobStaging" s
      WHERE s."ingestBatchId" = ${batchId}
        AND j."sourceId"    = s."sourceId"
        AND j."contentHash" = s."contentHash"
        AND s."observedAt"  > j."observedAt"
    `;

    return { inserted, contentUpdated, freshnessUpdated };
  });

  // ── Step 4: Count unchanged ───────────────────────────────────────────────
  const unchanged =
    valid.length -
    mergeResult.inserted -
    mergeResult.contentUpdated -
    mergeResult.freshnessUpdated;

  // ── Step 5: Clean up staging rows for this batch ──────────────────────────
  await prisma.jobStaging.deleteMany({
    where: { ingestBatchId: batchId },
  });

  return {
    batchId,
    total: records.length,
    new: mergeResult.inserted,
    contentChanged: mergeResult.contentUpdated,
    freshnessOnly: mergeResult.freshnessUpdated,
    unchanged: Math.max(0, unchanged),
    rejected,
    durationMs: Date.now() - startMs,
  };
}