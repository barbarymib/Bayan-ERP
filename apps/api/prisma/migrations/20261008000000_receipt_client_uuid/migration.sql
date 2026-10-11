-- معرّف الجهاز لسندات القبض — يمنع التكرار عند رفعها أوفلاين (منهج ADR 3)
ALTER TABLE "Receipt" ADD COLUMN "clientUuid" TEXT;
CREATE UNIQUE INDEX "Receipt_clientUuid_key" ON "Receipt"("clientUuid");