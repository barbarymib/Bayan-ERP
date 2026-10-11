-- AlterTable
ALTER TABLE "StocktakeSession" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "StocktakeLine" ADD CONSTRAINT "StocktakeLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
