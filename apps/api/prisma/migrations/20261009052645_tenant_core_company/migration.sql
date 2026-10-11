-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "CashAccount" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "CustodyHandover" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "CustomerGroup" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "CustomerRepAssignment" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "DailyClose" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "DeviceRegistration" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "ItemPrice" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "NumberBlock" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "OpeningBalance" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Period" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "PriceList" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "PriceStatement" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "PurchaseStatement" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "RepLocation" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "RepShift" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "RepTarget" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "RepVisit" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "ReturnStatement" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "SpecialPrice" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "StockBalance" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "StockReservation" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "StocktakeSession" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "SupplierReturn" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "VisitPlan" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "companyId" INTEGER;

-- CreateIndex
CREATE INDEX "Approval_companyId_idx" ON "Approval"("companyId");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE INDEX "Brand_companyId_idx" ON "Brand"("companyId");

-- CreateIndex
CREATE INDEX "CashAccount_companyId_idx" ON "CashAccount"("companyId");

-- CreateIndex
CREATE INDEX "Category_companyId_idx" ON "Category"("companyId");

-- CreateIndex
CREATE INDEX "CustodyHandover_companyId_idx" ON "CustodyHandover"("companyId");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE INDEX "CustomerGroup_companyId_idx" ON "CustomerGroup"("companyId");

-- CreateIndex
CREATE INDEX "CustomerRepAssignment_companyId_idx" ON "CustomerRepAssignment"("companyId");

-- CreateIndex
CREATE INDEX "DailyClose_companyId_idx" ON "DailyClose"("companyId");

-- CreateIndex
CREATE INDEX "DeviceRegistration_companyId_idx" ON "DeviceRegistration"("companyId");

-- CreateIndex
CREATE INDEX "Item_companyId_idx" ON "Item"("companyId");

-- CreateIndex
CREATE INDEX "ItemPrice_companyId_idx" ON "ItemPrice"("companyId");

-- CreateIndex
CREATE INDEX "LedgerEntry_companyId_idx" ON "LedgerEntry"("companyId");

-- CreateIndex
CREATE INDEX "NumberBlock_companyId_idx" ON "NumberBlock"("companyId");

-- CreateIndex
CREATE INDEX "OpeningBalance_companyId_idx" ON "OpeningBalance"("companyId");

-- CreateIndex
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");

-- CreateIndex
CREATE INDEX "Period_companyId_idx" ON "Period"("companyId");

-- CreateIndex
CREATE INDEX "PriceHistory_companyId_idx" ON "PriceHistory"("companyId");

-- CreateIndex
CREATE INDEX "PriceList_companyId_idx" ON "PriceList"("companyId");

-- CreateIndex
CREATE INDEX "PriceStatement_companyId_idx" ON "PriceStatement"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_idx" ON "PurchaseOrder"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseStatement_companyId_idx" ON "PurchaseStatement"("companyId");

-- CreateIndex
CREATE INDEX "Quotation_companyId_idx" ON "Quotation"("companyId");

-- CreateIndex
CREATE INDEX "Receipt_companyId_idx" ON "Receipt"("companyId");

-- CreateIndex
CREATE INDEX "RepLocation_companyId_idx" ON "RepLocation"("companyId");

-- CreateIndex
CREATE INDEX "RepShift_companyId_idx" ON "RepShift"("companyId");

-- CreateIndex
CREATE INDEX "RepTarget_companyId_idx" ON "RepTarget"("companyId");

-- CreateIndex
CREATE INDEX "RepVisit_companyId_idx" ON "RepVisit"("companyId");

-- CreateIndex
CREATE INDEX "ReturnStatement_companyId_idx" ON "ReturnStatement"("companyId");

-- CreateIndex
CREATE INDEX "SpecialPrice_companyId_idx" ON "SpecialPrice"("companyId");

-- CreateIndex
CREATE INDEX "StockBalance_companyId_idx" ON "StockBalance"("companyId");

-- CreateIndex
CREATE INDEX "StockMovement_companyId_idx" ON "StockMovement"("companyId");

-- CreateIndex
CREATE INDEX "StockReservation_companyId_idx" ON "StockReservation"("companyId");

-- CreateIndex
CREATE INDEX "StockTransfer_companyId_idx" ON "StockTransfer"("companyId");

-- CreateIndex
CREATE INDEX "StocktakeSession_companyId_idx" ON "StocktakeSession"("companyId");

-- CreateIndex
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");

-- CreateIndex
CREATE INDEX "SupplierReturn_companyId_idx" ON "SupplierReturn"("companyId");

-- CreateIndex
CREATE INDEX "VisitPlan_companyId_idx" ON "VisitPlan"("companyId");

-- CreateIndex
CREATE INDEX "Warehouse_companyId_idx" ON "Warehouse"("companyId");
