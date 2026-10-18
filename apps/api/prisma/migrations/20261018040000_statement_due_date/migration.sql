-- ALTER TABLE only (column-only migration is safe re: the bayan-schema note).
ALTER TABLE "PriceStatement" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

-- Backfill: dueDate = statement date + the customer's creditDays at write time
-- (powers the debt-aging buckets 0-30/31-60/61-90/+90 in §5.4).
UPDATE "PriceStatement" ps
SET "dueDate" = ps."date" + make_interval(days => COALESCE(c."creditDays", 0))
FROM "Customer" c
WHERE ps."customerId" = c."id" AND ps."dueDate" IS NULL;

-- Speed up overdue/aging lookups.
CREATE INDEX IF NOT EXISTS "PriceStatement_dueDate_idx" ON "PriceStatement"("dueDate");
