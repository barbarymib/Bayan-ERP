-- CreateEnum
CREATE TYPE "UnitMeasurement" AS ENUM ('COUNT', 'WEIGHT');

-- CreateEnum
CREATE TYPE "CustomerClassification" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('MAIN', 'REP', 'DAMAGED', 'SHOWROOM');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'OPENING');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentTerm" AS ENUM ('CASH', 'CREDIT', 'MIXED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CHEQUE', 'WALLET');

-- CreateEnum
CREATE TYPE "ReturnMode" AS ENUM ('BY_CUSTOMER', 'BY_REP');

-- CreateEnum
CREATE TYPE "GoodsCondition" AS ENUM ('GOOD', 'DAMAGED');

-- CreateEnum
CREATE TYPE "ReturnReasonCode" AS ENUM ('DEFECT', 'WRONG_ORDER', 'DAMAGED', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('ITEM_DISCOUNT', 'HEADER_DISCOUNT', 'BELOW_COST', 'RETURN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StocktakeStatus" AS ENUM ('OPEN', 'COUNTING', 'REVIEW', 'APPROVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('UNDER_COLLECTION', 'COLLECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'CASH');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('DONE', 'MISSED');

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "repCode" TEXT,
    "maxItemDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "maxInvoiceDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "parentId" INTEGER,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "measurement" "UnitMeasurement" NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "categoryId" INTEGER NOT NULL,
    "brandId" INTEGER,
    "origin" TEXT,
    "baseUnitId" INTEGER NOT NULL,
    "trackBatch" BOOLEAN NOT NULL DEFAULT false,
    "minStock" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "lastPurchaseCost" DECIMAL(18,4),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parentItemId" INTEGER,
    "imageUrl" TEXT,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAttribute" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ItemAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemUnit" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "factorToBase" DECIMAL(18,6) NOT NULL,
    "barcode" TEXT,
    "isSale" BOOLEAN NOT NULL DEFAULT true,
    "isPurchase" BOOLEAN NOT NULL DEFAULT true,
    "allowDecimal" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ItemUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPrice" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "priceListId" INTEGER NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "priceListId" INTEGER,
    "oldPrice" DECIMAL(18,4),
    "newPrice" DECIMAL(18,4) NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "activity" TEXT,
    "address" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "phone" TEXT,
    "phone2" TEXT,
    "taxNumber" TEXT,
    "priceListId" INTEGER NOT NULL,
    "creditLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "repId" INTEGER,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "classification" "CustomerClassification" NOT NULL DEFAULT 'C',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRepAssignment" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "repId" INTEGER NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toDate" TIMESTAMP(3),

    CONSTRAINT "CustomerRepAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'MAIN',
    "keeperId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "warehouseId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL DEFAULT '',
    "qtyBase" DECIMAL(18,3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("warehouseId","itemId","batchId")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL DEFAULT '',
    "qtyBase" DECIMAL(18,3) NOT NULL,
    "cost" DECIMAL(18,4),
    "refType" TEXT,
    "refId" INTEGER,
    "userId" INTEGER,
    "periodId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" SERIAL NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "archiveFile" TEXT,
    "checksum" TEXT,
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberBlock" (
    "id" SERIAL NOT NULL,
    "prefix" TEXT NOT NULL,
    "ownerCode" TEXT NOT NULL,
    "fromNo" INTEGER NOT NULL,
    "toNo" INTEGER NOT NULL,
    "lastUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumberBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceStatement" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "repId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatementStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentTerm" "PaymentTerm" NOT NULL DEFAULT 'CREDIT',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(18,2),
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(18,2) NOT NULL,
    "paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "periodId" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceStatementLine" (
    "id" SERIAL NOT NULL,
    "statementId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "factor" DECIMAL(18,6) NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "qtyBase" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "lineDiscountType" "DiscountType",
    "lineDiscountValue" DECIMAL(18,2),
    "lineDiscountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "allocatedHeaderDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netLine" DECIMAL(18,2) NOT NULL,
    "costSnapshot" DECIMAL(18,4),
    "weightNote" TEXT,
    "periodId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementRevision" (
    "id" SERIAL NOT NULL,
    "statementId" INTEGER NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "changedById" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnReason" (
    "id" SERIAL NOT NULL,
    "code" "ReturnReasonCode" NOT NULL,
    "nameAr" TEXT NOT NULL,

    CONSTRAINT "ReturnReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnStatement" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "clientUuid" TEXT,
    "mode" "ReturnMode" NOT NULL,
    "customerId" INTEGER,
    "repId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatementStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(18,2) NOT NULL,
    "reasonId" INTEGER,
    "notes" TEXT,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "periodId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnLine" (
    "id" SERIAL NOT NULL,
    "returnId" INTEGER NOT NULL,
    "sourceLineId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "qtyBase" DECIMAL(18,3) NOT NULL,
    "unitNetPrice" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "condition" "GoodsCondition" NOT NULL DEFAULT 'GOOD',
    "periodId" INTEGER,

    CONSTRAINT "ReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseStatement" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "clientUuid" TEXT,
    "supplierId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatementStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(18,2),
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(18,2) NOT NULL,
    "paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "periodId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseStatementLine" (
    "id" SERIAL NOT NULL,
    "statementId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "factor" DECIMAL(18,6) NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "qtyBase" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "lineDiscountType" "DiscountType",
    "lineDiscountValue" DECIMAL(18,2),
    "lineDiscountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netLine" DECIMAL(18,2) NOT NULL,
    "landedCost" DECIMAL(18,4),
    "periodId" INTEGER,

    CONSTRAINT "PurchaseStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "chequeId" INTEGER,
    "periodId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAllocation" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "statementId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "chequeId" INTEGER,
    "periodId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheque" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "ChequeStatus" NOT NULL DEFAULT 'UNDER_COLLECTION',
    "customerId" INTEGER,
    "supplierId" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" SERIAL NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" INTEGER NOT NULL,
    "refJson" JSONB,
    "requestedById" INTEGER NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER,
    "entryDate" DATE NOT NULL,
    "accountType" "LedgerAccountType" NOT NULL,
    "accountId" INTEGER NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refType" TEXT,
    "refId" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StocktakeSession" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "StocktakeStatus" NOT NULL DEFAULT 'OPEN',
    "scopeJson" JSONB,
    "openedById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "periodId" INTEGER,

    CONSTRAINT "StocktakeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StocktakeLine" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL DEFAULT '',
    "systemQtyBase" DECIMAL(18,3) NOT NULL,
    "countedQtyBase" DECIMAL(18,3),
    "diffQty" DECIMAL(18,3),
    "lastCost" DECIMAL(18,4),
    "diffValue" DECIMAL(18,2),
    "recountCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StocktakeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceRegistration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepShift" (
    "id" SERIAL NOT NULL,
    "repId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "startLat" DECIMAL(10,7),
    "startLng" DECIMAL(10,7),
    "endLat" DECIMAL(10,7),
    "endLng" DECIMAL(10,7),

    CONSTRAINT "RepShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepLocation" (
    "id" SERIAL NOT NULL,
    "repId" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "accuracy" DECIMAL(8,2),
    "battery" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepVisit" (
    "id" SERIAL NOT NULL,
    "repId" INTEGER NOT NULL,
    "shiftId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "status" "VisitStatus" NOT NULL,
    "reason" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_repCode_key" ON "User"("repCode");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_code_key" ON "Brand"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_barcode_key" ON "Item"("barcode");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Item_nameAr_idx" ON "Item"("nameAr");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAttribute_itemId_key_key" ON "ItemAttribute"("itemId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnit_barcode_key" ON "ItemUnit"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnit_itemId_unitId_key" ON "ItemUnit"("itemId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_code_key" ON "PriceList"("code");

-- CreateIndex
CREATE INDEX "ItemPrice_priceListId_idx" ON "ItemPrice"("priceListId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPrice_itemId_unitId_priceListId_key" ON "ItemPrice"("itemId", "unitId", "priceListId");

-- CreateIndex
CREATE INDEX "PriceHistory_itemId_changedAt_idx" ON "PriceHistory"("itemId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_repId_idx" ON "Customer"("repId");

-- CreateIndex
CREATE INDEX "Customer_nameAr_idx" ON "Customer"("nameAr");

-- CreateIndex
CREATE INDEX "CustomerRepAssignment_repId_fromDate_idx" ON "CustomerRepAssignment"("repId", "fromDate");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "StockBalance_itemId_idx" ON "StockBalance"("itemId");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_itemId_createdAt_idx" ON "StockMovement"("warehouseId", "itemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_refType_refId_idx" ON "StockMovement"("refType", "refId");

-- CreateIndex
CREATE INDEX "StockMovement_periodId_idx" ON "StockMovement"("periodId");

-- CreateIndex
CREATE INDEX "Period_status_idx" ON "Period"("status");

-- CreateIndex
CREATE INDEX "NumberBlock_prefix_ownerCode_idx" ON "NumberBlock"("prefix", "ownerCode");

-- CreateIndex
CREATE UNIQUE INDEX "NumberBlock_prefix_ownerCode_fromNo_key" ON "NumberBlock"("prefix", "ownerCode", "fromNo");

-- CreateIndex
CREATE UNIQUE INDEX "PriceStatement_number_key" ON "PriceStatement"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PriceStatement_clientUuid_key" ON "PriceStatement"("clientUuid");

-- CreateIndex
CREATE INDEX "PriceStatement_customerId_date_idx" ON "PriceStatement"("customerId", "date");

-- CreateIndex
CREATE INDEX "PriceStatement_repId_date_idx" ON "PriceStatement"("repId", "date");

-- CreateIndex
CREATE INDEX "PriceStatement_periodId_idx" ON "PriceStatement"("periodId");

-- CreateIndex
CREATE INDEX "PriceStatement_status_idx" ON "PriceStatement"("status");

-- CreateIndex
CREATE INDEX "PriceStatementLine_statementId_idx" ON "PriceStatementLine"("statementId");

-- CreateIndex
CREATE INDEX "PriceStatementLine_itemId_idx" ON "PriceStatementLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StatementRevision_statementId_revisionNo_key" ON "StatementRevision"("statementId", "revisionNo");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnReason_code_key" ON "ReturnReason"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnStatement_number_key" ON "ReturnStatement"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnStatement_clientUuid_key" ON "ReturnStatement"("clientUuid");

-- CreateIndex
CREATE INDEX "ReturnStatement_customerId_date_idx" ON "ReturnStatement"("customerId", "date");

-- CreateIndex
CREATE INDEX "ReturnStatement_repId_date_idx" ON "ReturnStatement"("repId", "date");

-- CreateIndex
CREATE INDEX "ReturnStatement_periodId_idx" ON "ReturnStatement"("periodId");

-- CreateIndex
CREATE INDEX "ReturnLine_returnId_idx" ON "ReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "ReturnLine_sourceLineId_idx" ON "ReturnLine"("sourceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseStatement_number_key" ON "PurchaseStatement"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseStatement_clientUuid_key" ON "PurchaseStatement"("clientUuid");

-- CreateIndex
CREATE INDEX "PurchaseStatement_supplierId_date_idx" ON "PurchaseStatement"("supplierId", "date");

-- CreateIndex
CREATE INDEX "PurchaseStatement_periodId_idx" ON "PurchaseStatement"("periodId");

-- CreateIndex
CREATE INDEX "PurchaseStatementLine_statementId_idx" ON "PurchaseStatementLine"("statementId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_number_key" ON "Receipt"("number");

-- CreateIndex
CREATE INDEX "Receipt_customerId_receivedAt_idx" ON "Receipt"("customerId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptAllocation_receiptId_statementId_key" ON "ReceiptAllocation"("receiptId", "statementId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_number_key" ON "Payment"("number");

-- CreateIndex
CREATE INDEX "Payment_supplierId_paidAt_idx" ON "Payment"("supplierId", "paidAt");

-- CreateIndex
CREATE INDEX "Cheque_status_dueDate_idx" ON "Cheque"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Approval_status_type_idx" ON "Approval"("status", "type");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountType_accountId_entryDate_idx" ON "LedgerEntry"("accountType", "accountId", "entryDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_periodId_idx" ON "LedgerEntry"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "StocktakeSession_number_key" ON "StocktakeSession"("number");

-- CreateIndex
CREATE INDEX "StocktakeSession_warehouseId_status_idx" ON "StocktakeSession"("warehouseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StocktakeLine_sessionId_itemId_batchId_key" ON "StocktakeLine"("sessionId", "itemId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRegistration_deviceId_key" ON "DeviceRegistration"("deviceId");

-- CreateIndex
CREATE INDEX "RepShift_repId_startedAt_idx" ON "RepShift"("repId", "startedAt");

-- CreateIndex
CREATE INDEX "RepLocation_repId_capturedAt_idx" ON "RepLocation"("repId", "capturedAt");

-- CreateIndex
CREATE INDEX "RepVisit_repId_at_idx" ON "RepVisit"("repId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_at_idx" ON "AuditLog"("userId", "at");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAttribute" ADD CONSTRAINT "ItemAttribute_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUnit" ADD CONSTRAINT "ItemUnit_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUnit" ADD CONSTRAINT "ItemUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPrice" ADD CONSTRAINT "ItemPrice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPrice" ADD CONSTRAINT "ItemPrice_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_repId_fkey" FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRepAssignment" ADD CONSTRAINT "CustomerRepAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_keeperId_fkey" FOREIGN KEY ("keeperId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceStatement" ADD CONSTRAINT "PriceStatement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceStatement" ADD CONSTRAINT "PriceStatement_repId_fkey" FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceStatement" ADD CONSTRAINT "PriceStatement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceStatement" ADD CONSTRAINT "PriceStatement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceStatement" ADD CONSTRAINT "PriceStatement_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceStatementLine" ADD CONSTRAINT "PriceStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PriceStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceStatementLine" ADD CONSTRAINT "PriceStatementLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementRevision" ADD CONSTRAINT "StatementRevision_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PriceStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnStatement" ADD CONSTRAINT "ReturnStatement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnStatement" ADD CONSTRAINT "ReturnStatement_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "ReturnReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnStatement" ADD CONSTRAINT "ReturnStatement_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_sourceLineId_fkey" FOREIGN KEY ("sourceLineId") REFERENCES "PriceStatementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseStatement" ADD CONSTRAINT "PurchaseStatement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseStatement" ADD CONSTRAINT "PurchaseStatement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseStatement" ADD CONSTRAINT "PurchaseStatement_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseStatementLine" ADD CONSTRAINT "PurchaseStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PurchaseStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseStatementLine" ADD CONSTRAINT "PurchaseStatementLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "Cheque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PriceStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "Cheque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeSession" ADD CONSTRAINT "StocktakeSession_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeSession" ADD CONSTRAINT "StocktakeSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeSession" ADD CONSTRAINT "StocktakeSession_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeSession" ADD CONSTRAINT "StocktakeSession_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeLine" ADD CONSTRAINT "StocktakeLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRegistration" ADD CONSTRAINT "DeviceRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepShift" ADD CONSTRAINT "RepShift_repId_fkey" FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepLocation" ADD CONSTRAINT "RepLocation_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "RepShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "RepShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepVisit" ADD CONSTRAINT "RepVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
