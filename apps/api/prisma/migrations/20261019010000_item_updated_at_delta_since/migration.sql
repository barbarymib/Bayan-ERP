-- R3-F2: delta since= filter on Item — "updatedAt" column was missing from the
-- schema, so every GET /sync/delta?since=... call threw Prisma "Unknown argument
-- `updatedAt`" (500) — i.e. every mobile sync after the first one.
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows so the first incremental sync after this migration is a
-- superset (all items re-sent once) instead of throwing or silently filtering out
-- live inventory edits made before the column existed.
UPDATE "Item" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- Speeds up the since= filter (same shape as other delta-filtered models).
CREATE INDEX IF NOT EXISTS "Item_updatedAt_idx" ON "Item"("updatedAt");
