# TutorPlatform Stage A SQL Review

Status: design only; not approved for execution.

## Scope

- Add public-visibility and featured-ordering metadata to `Demand`.
- Add immutable administrator operation logs.
- Keep every historical demand hidden until an administrator approves it.
- Never derive `publicSummary` from historical `description`.

## Files

- `migration.sql`: additive PostgreSQL schema proposal.
- `backfill.sql`: one-time privacy-safe historical-data normalization.
- `rollback.sql`: destructive emergency rollback proposal.

These files deliberately remain outside `backend/prisma/migrations`, so the
current Railway pre-deploy command cannot discover or execute them.

## Migration review

The migration contains no `DROP`, `DELETE`, `TRUNCATE`, rename, or existing
column type conversion. Existing business columns and rows remain intact.

New non-null columns use constant safe defaults:

- `visibilityStatus = HIDDEN`
- `isFeatured = false`
- `sortWeight = 0`
- `viewCount = 0`

PostgreSQL stores operation-log snapshots as `JSONB`, matching Prisma `Json`.
The administrator foreign key uses `ON DELETE RESTRICT` so audit ownership
cannot be silently removed.

## Historical data review

The backfill intentionally exposes zero records. It clears only newly added
public-operation metadata and does not modify `description`, demand status,
applications, conversations, trial lessons, or reviews.

It must run exactly once in the same controlled release window as the schema
migration, before the new application version accepts administrator approvals.
Running it later would hide demands approved after launch.

Expected verification result:

```text
exposed_count = 0
```

## Configurable expiry

The database does not hard-code a 30-day expiry. Application code will read:

```text
DEFAULT_DEMAND_EXPIRE_DAYS=30
```

The future admin listing operation will compute `expiresAt` from this setting
when no explicit expiry is supplied. Startup validation will require a positive
integer and use 30 only as the documented environment default.

## Operational risks

1. `ALTER TABLE` takes a lock; execute during a low-traffic maintenance window.
2. The backfill updates every existing `Demand` row; the current MVP dataset is
   expected to be small, but row count and table size must be checked first.
3. The rollback permanently deletes visibility metadata and audit logs.
4. Railway currently runs `prisma migrate deploy` automatically before deploy;
   no formal migration may be committed or pushed until execution approval.

## Required pre-execution checks

1. Create and verify a Railway PostgreSQL backup.
2. Record row counts for `User`, `Demand`, `Application`, and operation logs.
3. Confirm there is no concurrent admin visibility operation.
4. Review the final Prisma-generated SQL against this design.
5. Confirm `DATABASE_URL` points to the intended Railway PostgreSQL service.

## Rollback policy

Prefer application rollback and keep the additive database objects in place.
Use `rollback.sql` only when the schema itself must be removed, after backup and
explicit approval. A rollback execution would permanently delete operation-log
history and all visibility settings.
