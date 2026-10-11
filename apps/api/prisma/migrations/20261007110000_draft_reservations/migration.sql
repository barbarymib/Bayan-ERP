-- Draft quantity reservation (optional §5.7)
CREATE TABLE "StockReservation" (
    "id" SERIAL NOT NULL,
    "refType" TEXT NOT NULL DEFAULT 'price_statement',
    "refId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL DEFAULT '',
    "qtyBase" DECIMAL(18,3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockReservation_warehouseId_itemId_status_idx" ON "StockReservation"("warehouseId", "itemId", "status");
CREATE INDEX "StockReservation_refType_refId_status_idx" ON "StockReservation"("refType", "refId", "status");