-- استضافة متعددة الشركات (SaaS): سجل الشركات + المشرف العام + ميزات النظام.
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "Company" (
    "id" serial PRIMARY KEY,
    "code" text NOT NULL UNIQUE,
    "nameAr" text NOT NULL,
    "phone" text,
    "email" text,
    "contactName" text,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL
);

CREATE TABLE "GlobalAdmin" (
    "id" serial PRIMARY KEY,
    "username" text NOT NULL UNIQUE,
    "passwordHash" text NOT NULL,
    "nameAr" text NOT NULL,
    "active" boolean NOT NULL DEFAULT true,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SystemFeature" (
    "id" serial PRIMARY KEY,
    "code" text NOT NULL UNIQUE,
    "nameAr" text NOT NULL,
    "enabled" boolean NOT NULL DEFAULT true
);

CREATE TABLE "CompanyFeature" (
    "companyId" integer NOT NULL,
    "featureId" integer NOT NULL,
    "enabled" boolean NOT NULL,
    CONSTRAINT "CompanyFeature_pkey" PRIMARY KEY ("companyId", "featureId"),
    CONSTRAINT "CompanyFeature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "SystemFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "UserFeature" (
    "userId" integer NOT NULL,
    "featureId" integer NOT NULL,
    "enabled" boolean NOT NULL,
    CONSTRAINT "UserFeature_pkey" PRIMARY KEY ("userId", "featureId"),
    CONSTRAINT "UserFeature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "SystemFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "User" ADD COLUMN "companyId" integer;
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "UserFeature_featureId_idx" ON "UserFeature"("featureId");
CREATE INDEX "CompanyFeature_featureId_idx" ON "CompanyFeature"("featureId");