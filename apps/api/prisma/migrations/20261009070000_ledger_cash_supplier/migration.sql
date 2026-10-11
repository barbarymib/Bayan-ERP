-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cashAccountId" INTEGER;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "cashAccountId" INTEGER;

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "purchaseStatementId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_purchaseStatementId_key" ON "PaymentAllocation"("paymentId", "purchaseStatementId");

-- CreateIndex
CREATE INDEX "Payment_cashAccountId_idx" ON "Payment"("cashAccountId");

-- CreateIndex
CREATE INDEX "Receipt_cashAccountId_idx" ON "Receipt"("cashAccountId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_purchaseStatementId_fkey" FOREIGN KEY ("purchaseStatementId") REFERENCES "PurchaseStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
