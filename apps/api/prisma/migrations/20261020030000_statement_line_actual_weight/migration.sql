-- R4-C3: الوزن الفعلي لبند البيان (§5.2) — يُقارَن بالنظري (qtyBase) لإظهار الفرق لأصناف الحديد

ALTER TABLE public."PriceStatementLine" ADD COLUMN "actualWeight" DECIMAL(18,3);
