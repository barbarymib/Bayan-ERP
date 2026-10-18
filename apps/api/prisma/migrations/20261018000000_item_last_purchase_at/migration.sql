-- R3-A11 (§5.3): تخزين تاريخ آخر عملية شراء للصنف
ALTER TABLE public."Item" ADD COLUMN "lastPurchaseAt" TIMESTAMP(3);
