-- R3-A13: company-level currency (default EGP, §3).
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EGP';
