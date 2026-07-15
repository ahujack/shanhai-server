-- Affiliate partners and commission ledger for launch marketing channels.

CREATE TABLE "AffiliatePartner" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  "attributionDays" INTEGER NOT NULL DEFAULT 30,
  "recurringDays" INTEGER NOT NULL DEFAULT 180,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AffiliatePartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateCommission" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount" DOUBLE PRECISION NOT NULL,
  "commissionRate" DOUBLE PRECISION NOT NULL,
  "commissionAmount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sourceReferralCode" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),

  CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User"
  ADD COLUMN "affiliatePartnerId" TEXT,
  ADD COLUMN "affiliateReferralCode" TEXT;

CREATE UNIQUE INDEX "AffiliatePartner_code_key" ON "AffiliatePartner"("code");
CREATE UNIQUE INDEX "AffiliateCommission_paymentId_key" ON "AffiliateCommission"("paymentId");
CREATE INDEX "AffiliatePartner_isActive_idx" ON "AffiliatePartner"("isActive");
CREATE INDEX "AffiliatePartner_createdAt_idx" ON "AffiliatePartner"("createdAt");
CREATE INDEX "AffiliateCommission_partnerId_idx" ON "AffiliateCommission"("partnerId");
CREATE INDEX "AffiliateCommission_userId_idx" ON "AffiliateCommission"("userId");
CREATE INDEX "AffiliateCommission_status_idx" ON "AffiliateCommission"("status");
CREATE INDEX "AffiliateCommission_createdAt_idx" ON "AffiliateCommission"("createdAt");
CREATE INDEX "User_affiliatePartnerId_idx" ON "User"("affiliatePartnerId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_affiliatePartnerId_fkey"
  FOREIGN KEY ("affiliatePartnerId") REFERENCES "AffiliatePartner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT "AffiliateCommission_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "AffiliatePartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT "AffiliateCommission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT "AffiliateCommission_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
