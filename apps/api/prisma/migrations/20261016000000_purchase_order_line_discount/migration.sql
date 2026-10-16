-- AlterTable: purchase order line discounts (§5.5) — carry line discount onto receive
ALTER TABLE "PurchaseOrderLine"
  ADD COLUMN "lineDiscountType" "DiscountType",
  ADD COLUMN "lineDiscountValue" DECIMAL(18,2),
  ADD COLUMN "lineDiscountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
