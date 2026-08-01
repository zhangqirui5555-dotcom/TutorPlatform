-- TutorPlatform Stage A destructive rollback design
-- DO NOT EXECUTE without explicit approval and a verified database backup.
-- This removes Stage A operation logs and all visibility metadata permanently.

BEGIN;

DROP TABLE IF EXISTS "AdminOperationLog";

DROP INDEX IF EXISTS "Demand_status_visibilityStatus_expiresAt_publishedAt_idx";
DROP INDEX IF EXISTS "Demand_isFeatured_visibilityStatus_sortWeight_featuredUntil_idx";
DROP INDEX IF EXISTS "Demand_parentId_visibilityStatus_status_idx";

ALTER TABLE "Demand"
DROP COLUMN IF EXISTS "visibilityStatus",
DROP COLUMN IF EXISTS "publicSummary",
DROP COLUMN IF EXISTS "isFeatured",
DROP COLUMN IF EXISTS "sortWeight",
DROP COLUMN IF EXISTS "featuredAt",
DROP COLUMN IF EXISTS "featuredUntil",
DROP COLUMN IF EXISTS "expiresAt",
DROP COLUMN IF EXISTS "listedAt",
DROP COLUMN IF EXISTS "unlistedAt",
DROP COLUMN IF EXISTS "viewCount";

COMMIT;
