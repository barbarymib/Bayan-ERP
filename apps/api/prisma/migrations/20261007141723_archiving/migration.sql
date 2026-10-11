-- CreateEnum
CREATE TYPE "ArchiveRunStatus" AS ENUM ('PRECHECKS', 'READY', 'CONFIRMED', 'RESTORED', 'FAILED');

-- CreateEnum
CREATE TYPE "OpeningBalanceKind" AS ENUM ('CUSTOMER', 'SUPPLIER', 'ITEM', 'CASH');

-- CreateTable
CREATE TABLE "ArchiveRun" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "status" "ArchiveRunStatus" NOT NULL DEFAULT 'PRECHECKS',
    "checks" JSONB,
    "manifest" JSONB,
    "counts" JSONB,
    "bundlePath" TEXT,
    "bundleSha256" TEXT,
    "backupPath" TEXT,
    "note" TEXT,
    "periodId" INTEGER,
    "createdById" INTEGER,
    "confirmedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "ArchiveRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningBalance" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "kind" "OpeningBalanceKind" NOT NULL,
    "accountId" INTEGER NOT NULL DEFAULT 0,
    "itemId" INTEGER,
    "warehouseId" INTEGER,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "qtyBase" DECIMAL(18,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveRun_code_key" ON "ArchiveRun"("code");

-- CreateIndex
CREATE INDEX "ArchiveRun_status_idx" ON "ArchiveRun"("status");

-- CreateIndex
CREATE INDEX "OpeningBalance_kind_idx" ON "OpeningBalance"("kind");

-- CreateIndex
CREATE INDEX "OpeningBalance_runId_idx" ON "OpeningBalance"("runId");

-- AddForeignKey
ALTER TABLE "ArchiveRun" ADD CONSTRAINT "ArchiveRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveRun" ADD CONSTRAINT "ArchiveRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveRun" ADD CONSTRAINT "ArchiveRun_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalance" ADD CONSTRAINT "OpeningBalance_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ArchiveRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
