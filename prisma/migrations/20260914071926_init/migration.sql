-- CreateEnum
CREATE TYPE "RemotePreference" AS ENUM ('required', 'allowed', 'not_allowed');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'processing', 'sent', 'failed');

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "roles" TEXT[],
    "skills" TEXT[],
    "locations" TEXT[],
    "remotePreference" "RemotePreference" NOT NULL DEFAULT 'allowed',
    "excludeTerms" TEXT[],
    "unknowns" TEXT[],
    "parseFallback" BOOLEAN NOT NULL DEFAULT false,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "skills" TEXT[],
    "contentHash" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFileDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStaging" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "skills" TEXT[],
    "contentHash" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "sourceFileDate" TIMESTAMP(3),
    "ingestBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobStaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMatch" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "jobIds" TEXT[],
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failedReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_sourceId_key" ON "Job"("sourceId");

-- CreateIndex
CREATE INDEX "Job_contentHash_idx" ON "Job"("contentHash");

-- CreateIndex
CREATE INDEX "Job_location_idx" ON "Job"("location");

-- CreateIndex
CREATE INDEX "Job_remote_idx" ON "Job"("remote");

-- CreateIndex
CREATE INDEX "Job_skills_idx" ON "Job"("skills");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "JobStaging_ingestBatchId_idx" ON "JobStaging"("ingestBatchId");

-- CreateIndex
CREATE INDEX "JobStaging_sourceId_idx" ON "JobStaging"("sourceId");

-- CreateIndex
CREATE INDEX "JobStaging_contentHash_idx" ON "JobStaging"("contentHash");

-- CreateIndex
CREATE INDEX "JobMatch_alertId_idx" ON "JobMatch"("alertId");

-- CreateIndex
CREATE INDEX "JobMatch_jobId_idx" ON "JobMatch"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_alertId_jobId_key" ON "JobMatch"("alertId", "jobId");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_createdAt_idx" ON "NotificationOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_userId_idx" ON "NotificationOutbox"("userId");

-- CreateIndex
CREATE INDEX "NotificationOutbox_alertId_idx" ON "NotificationOutbox"("alertId");

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
