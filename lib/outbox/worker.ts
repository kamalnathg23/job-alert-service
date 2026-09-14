import { PrismaClient, OutboxStatus } from "@prisma/client";
const prisma = new PrismaClient();
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

/**
 * Simulates sending a notification.
 * In production this would call an email/push API.
 */
async function sendNotification(
  userId: string,
  alertId: string,
  jobIds: string[]
): Promise<void> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 10));
  console.log(
    `[outbox] sent digest to user=${userId} alert=${alertId} jobs=${jobIds.length}`
  );
}

/**
 * Processes one batch of pending notifications.
 * Returns counts of sent and failed.
 */
export async function processOutbox(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

    // Claim a batch atomically — move pending → processing
  const batch = await prisma.notificationOutbox.findMany({
    where: {
      status: OutboxStatus.pending,
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

    if (batch.length === 0) return { sent: 0, failed: 0, skipped: 0 };
      // Mark all as processing atomically
  await prisma.notificationOutbox.updateMany({
    where: {
      id: { in: batch.map((n) => n.id) },
      status: OutboxStatus.pending,
    },
    data: { status: OutboxStatus.processing },
  });

    // Process each notification
  for (const notification of batch) {
    try {
      await sendNotification(
        notification.userId,
        notification.alertId,
        notification.jobIds
      );

            // Mark as sent
      await prisma.notificationOutbox.update({
        where: { id: notification.id },
        data: {
          status: OutboxStatus.sent,
          processedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      sent++;


          } catch (err) {
      const newAttempts = notification.attempts + 1;
      const permanentlyFailed = newAttempts >= MAX_ATTEMPTS;

      await prisma.notificationOutbox.update({
        where: { id: notification.id },
        data: {
          status: permanentlyFailed
            ? OutboxStatus.failed
            : OutboxStatus.pending,
          attempts: { increment: 1 },
          failedReason: String(err),
          processedAt: permanentlyFailed ? new Date() : null,
        },
      });

      if (permanentlyFailed) {
        failed++;
        console.error(`[outbox] permanently failed id=${notification.id}`);
      } else {
        skipped++;
        console.warn(`[outbox] will retry id=${notification.id} attempts=${newAttempts}`);
      }
    }
  }

    return { sent, failed, skipped };
}

/**
 * Queues a notification in the outbox.
 * Called by the matcher after finding matches.
 */
export async function queueNotification(
  userId: string,
  alertId: string,
  jobIds: string[]
): Promise<void> {
  if (jobIds.length === 0) return;

  await prisma.notificationOutbox.create({
    data: {
      userId,
      alertId,
      jobIds,
      status: OutboxStatus.pending,
    },
  });
}