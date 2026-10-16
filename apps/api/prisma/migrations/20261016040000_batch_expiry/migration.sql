-- R3-A5 (§5.1): دفعات الأصناف مع تتبع تاريخ الصلاحية (للبويات مثلاً).
-- ملاحظة: نُصرّح بالمخطط public. صراحةً لأنّ ترحيل RLS يُنشئ مخططاً باسم دور
-- قاعدة البيانات (bayan) يتقدّم في search_path، فتُنشأ الجداول غير المؤهَّلة فيه.

CREATE TABLE public."Batch" (
    "companyId" INTEGER,
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "productionDate" DATE,
    "expiry" DATE,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Batch_companyId_itemId_code_key" ON public."Batch"("companyId", "itemId", "code");
CREATE INDEX "Batch_companyId_idx" ON public."Batch"("companyId");
CREATE INDEX "Batch_itemId_idx" ON public."Batch"("itemId");
CREATE INDEX "Batch_expiry_idx" ON public."Batch"("expiry");

ALTER TABLE public."Batch" ADD CONSTRAINT "Batch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public."Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- بند التوريد يحفظ كود الدفعة المستلمة
ALTER TABLE public."PurchaseStatementLine" ADD COLUMN "batchId" TEXT NOT NULL DEFAULT '';
