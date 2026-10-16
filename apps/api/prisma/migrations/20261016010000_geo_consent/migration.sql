-- §5.13: إقرار/موافقة موقّعة على تتبع الموقع أثناء الوردية (قانون 151/2020)

CREATE TABLE "ConsentRecord" (
    "companyId" INTEGER,
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "signatureName" TEXT NOT NULL,
    "deviceId" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsentRecord_companyId_idx" ON "ConsentRecord"("companyId");

CREATE INDEX "ConsentRecord_userId_type_acceptedAt_idx" ON "ConsentRecord"("userId", "type", "acceptedAt");

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
