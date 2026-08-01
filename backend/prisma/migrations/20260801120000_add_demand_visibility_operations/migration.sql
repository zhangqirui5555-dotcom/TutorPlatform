-- TutorPlatform Stage A: public demand visibility and administrator operations.
-- Historical demands remain private until an administrator explicitly lists them.

BEGIN;

ALTER TABLE "Demand"
ADD COLUMN "visibilityStatus" TEXT NOT NULL DEFAULT 'HIDDEN',
ADD COLUMN "publicSummary" TEXT,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sortWeight" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "featuredAt" TIMESTAMP(3),
ADD COLUMN "featuredUntil" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "listedAt" TIMESTAMP(3),
ADD COLUMN "unlistedAt" TIMESTAMP(3),
ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- Privacy-safe historical backfill. Never derive publicSummary from description.
UPDATE "Demand"
SET
    "visibilityStatus" = 'HIDDEN',
    "publicSummary" = NULL,
    "isFeatured" = false,
    "sortWeight" = 0,
    "featuredAt" = NULL,
    "featuredUntil" = NULL,
    "expiresAt" = NULL,
    "listedAt" = NULL,
    "unlistedAt" = NULL,
    "viewCount" = 0;

CREATE TABLE "AdminOperationLog" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminOperationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Demand_status_visibilityStatus_expiresAt_publishedAt_idx"
ON "Demand"("status", "visibilityStatus", "expiresAt", "publishedAt");

CREATE INDEX "Demand_isFeatured_visibilityStatus_sortWeight_featuredUntil_idx"
ON "Demand"("isFeatured", "visibilityStatus", "sortWeight", "featuredUntil");

CREATE INDEX "Demand_parentId_visibilityStatus_status_idx"
ON "Demand"("parentId", "visibilityStatus", "status");

CREATE INDEX "AdminOperationLog_adminId_createdAt_idx"
ON "AdminOperationLog"("adminId", "createdAt");

CREATE INDEX "AdminOperationLog_targetType_targetId_createdAt_idx"
ON "AdminOperationLog"("targetType", "targetId", "createdAt");

CREATE INDEX "AdminOperationLog_action_createdAt_idx"
ON "AdminOperationLog"("action", "createdAt");

ALTER TABLE "AdminOperationLog"
ADD CONSTRAINT "AdminOperationLog_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
