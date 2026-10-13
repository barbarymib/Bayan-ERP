-- AlterEnum
ALTER TYPE "ApprovalType" ADD VALUE 'BELOW_MIN_PRICE';

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "minSalePrice" DECIMAL(18,4);
