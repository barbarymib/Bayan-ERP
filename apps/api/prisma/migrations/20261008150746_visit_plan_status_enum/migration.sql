/*
  Warnings:

  - The `status` column on the `VisitPlanLine` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "VisitPlanLine" DROP COLUMN "status",
ADD COLUMN     "status" "VisitPlanStatus" NOT NULL DEFAULT 'MISSED';
