-- R4-B8: §6.1 rejection loop «رفض ← عودة للتعديل» — record the approver's rejection
-- reason on the document so the creator can revise and resubmit from DRAFT.
ALTER TABLE "PriceStatement" ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT;
ALTER TABLE "ReturnStatement" ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT;
