-- DropIndex
DROP INDEX "Branch_code_key";

-- DropIndex
DROP INDEX "Brand_code_key";

-- DropIndex
DROP INDEX "CashAccount_code_key";

-- DropIndex
DROP INDEX "Category_code_key";

-- DropIndex
DROP INDEX "CustodyHandover_number_key";

-- DropIndex
DROP INDEX "Customer_code_key";

-- DropIndex
DROP INDEX "CustomerGroup_code_key";

-- DropIndex
DROP INDEX "DailyClose_date_key";

-- DropIndex
DROP INDEX "DeviceRegistration_deviceId_key";

-- DropIndex
DROP INDEX "Item_barcode_key";

-- DropIndex
DROP INDEX "Item_code_key";

-- DropIndex
DROP INDEX "NumberBlock_prefix_ownerCode_fromNo_key";

-- DropIndex
DROP INDEX "Payment_number_key";

-- DropIndex
DROP INDEX "PriceList_code_key";

-- DropIndex
DROP INDEX "PriceStatement_clientUuid_key";

-- DropIndex
DROP INDEX "PriceStatement_number_key";

-- DropIndex
DROP INDEX "PurchaseOrder_number_key";

-- DropIndex
DROP INDEX "PurchaseStatement_clientUuid_key";

-- DropIndex
DROP INDEX "PurchaseStatement_number_key";

-- DropIndex
DROP INDEX "Quotation_clientUuid_key";

-- DropIndex
DROP INDEX "Quotation_convertedStatementId_key";

-- DropIndex
DROP INDEX "Quotation_number_key";

-- DropIndex
DROP INDEX "Receipt_clientUuid_key";

-- DropIndex
DROP INDEX "Receipt_number_key";

-- DropIndex
DROP INDEX "ReturnStatement_clientUuid_key";

-- DropIndex
DROP INDEX "ReturnStatement_number_key";

-- DropIndex
DROP INDEX "StockTransfer_number_key";

-- DropIndex
DROP INDEX "StocktakeSession_number_key";

-- DropIndex
DROP INDEX "Supplier_code_key";

-- DropIndex
DROP INDEX "SupplierReturn_number_key";

-- DropIndex
DROP INDEX "VisitPlan_repId_date_key";

-- DropIndex
DROP INDEX "Warehouse_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_companyId_code_key" ON "Brand"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CashAccount_companyId_code_key" ON "CashAccount"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_code_key" ON "Category"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CustodyHandover_companyId_number_key" ON "CustodyHandover"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGroup_companyId_code_key" ON "CustomerGroup"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClose_companyId_date_key" ON "DailyClose"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRegistration_companyId_deviceId_key" ON "DeviceRegistration"("companyId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_companyId_code_key" ON "Item"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_companyId_barcode_key" ON "Item"("companyId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "NumberBlock_companyId_prefix_ownerCode_fromNo_key" ON "NumberBlock"("companyId", "prefix", "ownerCode", "fromNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_companyId_number_key" ON "Payment"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_companyId_code_key" ON "PriceList"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PriceStatement_companyId_number_key" ON "PriceStatement"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PriceStatement_companyId_clientUuid_key" ON "PriceStatement"("companyId", "clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_companyId_number_key" ON "PurchaseOrder"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseStatement_companyId_number_key" ON "PurchaseStatement"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseStatement_companyId_clientUuid_key" ON "PurchaseStatement"("companyId", "clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_companyId_number_key" ON "Quotation"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_companyId_clientUuid_key" ON "Quotation"("companyId", "clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_companyId_convertedStatementId_key" ON "Quotation"("companyId", "convertedStatementId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_companyId_number_key" ON "Receipt"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_companyId_clientUuid_key" ON "Receipt"("companyId", "clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnStatement_companyId_number_key" ON "ReturnStatement"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnStatement_companyId_clientUuid_key" ON "ReturnStatement"("companyId", "clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_companyId_number_key" ON "StockTransfer"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StocktakeSession_companyId_number_key" ON "StocktakeSession"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_code_key" ON "Supplier"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReturn_companyId_number_key" ON "SupplierReturn"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "VisitPlan_companyId_repId_date_key" ON "VisitPlan"("companyId", "repId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_code_key" ON "Warehouse"("companyId", "code");