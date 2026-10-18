-- R3-B15: company-level default tax rate.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
