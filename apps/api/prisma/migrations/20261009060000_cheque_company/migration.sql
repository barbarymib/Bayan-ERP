-- AlterTable
ALTER TABLE "Cheque" ADD COLUMN     "companyId" INTEGER;

-- CreateIndex
CREATE INDEX "Cheque_companyId_idx" ON "Cheque"("companyId");
