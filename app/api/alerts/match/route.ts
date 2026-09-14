import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { matchJobToAlert } from "@/lib/matcher/match";
import { queueNotification } from "@/lib/outbox/worker";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const alerts = await prisma.alert.findMany();
    const jobs = await prisma.job.findMany();

    const results = [];

    for (const alert of alerts) {
      for (const job of jobs) {
        const result = matchJobToAlert(alert, job);

        if (result.matched) {
          await prisma.jobMatch.upsert({
            where: {
              alertId_jobId: {
                alertId: alert.id,
                jobId: job.id,
              },
            },
            update: {
              score: result.score,
              reasons: result.reasons,
            },
            create: {
              alertId: alert.id,
              jobId: job.id,
              score: result.score,
              reasons: result.reasons,
            },
          });

          results.push({
            alertId: alert.id,
            jobId: job.id,
            score: result.score,
            reasons: result.reasons,
          });
        }
      }

      // Queue one notification per alert with all matched jobIds
      const matchedJobIds = results
        .filter((r) => r.alertId === alert.id)
        .map((r) => r.jobId);

      if (matchedJobIds.length > 0) {
        await queueNotification(alert.userId, alert.id, matchedJobIds);
      }
    }

    return NextResponse.json({
      ok: true,
      matchesFound: results.length,
      matches: results,
    });

  } catch (err) {
    console.error("[matcher] error", err);
    return NextResponse.json(
      { error: "Matching failed", message: String(err) },
      { status: 500 }
    );
  }
}