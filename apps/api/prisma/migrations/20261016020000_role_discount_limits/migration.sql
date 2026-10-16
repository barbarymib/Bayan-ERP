-- §4.2: حدود الخصم على مستوى الدور (نسبة قصوى على الصنف/البيان).
-- ملاحظة: نُصرّح بـ public. لأن ترحيل RLS يُنشئ مخططاً باسم دور قاعدة البيانات (bayan).
ALTER TABLE public."Role" ADD COLUMN "maxItemDiscountPct" DECIMAL(5, 2);
ALTER TABLE public."Role" ADD COLUMN "maxInvoiceDiscountPct" DECIMAL(5, 2);
