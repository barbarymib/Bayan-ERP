-- R3-E6: periodic restore drill — record the outcome of the last restore test
-- performed against each encrypted backup (§9).
ALTER TABLE "AutomatedBackup" ADD COLUMN IF NOT EXISTS "lastDrillAt" TIMESTAMP(3);
ALTER TABLE "AutomatedBackup" ADD COLUMN IF NOT EXISTS "lastDrillOk" BOOLEAN;
ALTER TABLE "AutomatedBackup" ADD COLUMN IF NOT EXISTS "lastDrillDetail" TEXT;
