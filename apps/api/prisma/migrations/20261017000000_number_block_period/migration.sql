-- R3-C13 (§5.11.8): فترة/سنة اختيارية في ترقيم المستندات (نمط BP-2027-000001) مع إعادة ضبط التسلسل لكل فترة.
-- ملاحظة النشر: دور `bayan` له search_path = `bayan, public`، لذا نؤهّل كل شيء بـ `public.` صراحةً.
-- الجدول موجود مسبقاً (public."NumberBlock")، و RLS لا يؤثر على ALTER TABLE.

ALTER TABLE public."NumberBlock" ADD COLUMN "period" INTEGER NOT NULL DEFAULT 0;

DROP INDEX public."NumberBlock_companyId_prefix_ownerCode_fromNo_key";
DROP INDEX public."NumberBlock_prefix_ownerCode_idx";

CREATE UNIQUE INDEX "NumberBlock_companyId_prefix_ownerCode_period_fromNo_key"
  ON public."NumberBlock"("companyId", "prefix", "ownerCode", "period", "fromNo");
CREATE INDEX "NumberBlock_prefix_ownerCode_period_idx"
  ON public."NumberBlock"("prefix", "ownerCode", "period");
