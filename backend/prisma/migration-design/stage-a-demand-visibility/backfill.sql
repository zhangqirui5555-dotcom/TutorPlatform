-- TutorPlatform Stage A historical-data backfill
-- REVIEW ONLY: run once, immediately after the approved schema migration and
-- before enabling the Stage A application release.
--
-- Privacy rule:
--   * every demand existing at execution time remains HIDDEN;
--   * no public summary is generated;
--   * the historical description is never copied to publicSummary;
--   * no historical demand is featured or given a public expiry/listing time.

BEGIN;

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
    "unlistedAt" = NULL;

COMMIT;

-- Post-run verification. Expected exposed_count = 0.
SELECT COUNT(*) AS exposed_count
FROM "Demand"
WHERE "visibilityStatus" <> 'HIDDEN'
   OR "publicSummary" IS NOT NULL
   OR "isFeatured" = true
   OR "listedAt" IS NOT NULL;
