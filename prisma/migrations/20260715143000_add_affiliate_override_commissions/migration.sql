-- Add second-level affiliate hierarchy and override commission ledger.

ALTER TABLE "AffiliatePartner"
  ADD COLUMN "parentPartnerId" TEXT,
  ADD COLUMN "overrideCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05;

CREATE TABLE "AffiliateOverrideCommission" (
  "id" TEXT NOT NULL,
  "parentPartnerId" TEXT NOT NULL,
  "childPartnerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "baseCommissionId" TEXT NOT NULL,
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "netAmount" DOUBLE PRECISION NOT NULL,
  "baseCommissionAmount" DOUBLE PRECISION NOT NULL,
  "overrideRate" DOUBLE PRECISION NOT NULL,
  "overrideAmount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sourceReferralCode" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),

  CONSTRAINT "AffiliateOverrideCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AffiliateOverrideCommission_paymentId_key" ON "AffiliateOverrideCommission"("paymentId");
CREATE UNIQUE INDEX "AffiliateOverrideCommission_baseCommissionId_key" ON "AffiliateOverrideCommission"("baseCommissionId");
CREATE INDEX "AffiliatePartner_parentPartnerId_idx" ON "AffiliatePartner"("parentPartnerId");
CREATE INDEX "AffiliateOverrideCommission_parentPartnerId_idx" ON "AffiliateOverrideCommission"("parentPartnerId");
CREATE INDEX "AffiliateOverrideCommission_childPartnerId_idx" ON "AffiliateOverrideCommission"("childPartnerId");
CREATE INDEX "AffiliateOverrideCommission_userId_idx" ON "AffiliateOverrideCommission"("userId");
CREATE INDEX "AffiliateOverrideCommission_status_idx" ON "AffiliateOverrideCommission"("status");
CREATE INDEX "AffiliateOverrideCommission_createdAt_idx" ON "AffiliateOverrideCommission"("createdAt");

ALTER TABLE "AffiliatePartner"
  ADD CONSTRAINT "AffiliatePartner_parentPartnerId_fkey"
  FOREIGN KEY ("parentPartnerId") REFERENCES "AffiliatePartner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AffiliateOverrideCommission"
  ADD CONSTRAINT "AffiliateOverrideCommission_parentPartnerId_fkey"
  FOREIGN KEY ("parentPartnerId") REFERENCES "AffiliatePartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateOverrideCommission"
  ADD CONSTRAINT "AffiliateOverrideCommission_childPartnerId_fkey"
  FOREIGN KEY ("childPartnerId") REFERENCES "AffiliatePartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateOverrideCommission"
  ADD CONSTRAINT "AffiliateOverrideCommission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateOverrideCommission"
  ADD CONSTRAINT "AffiliateOverrideCommission_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateOverrideCommission"
  ADD CONSTRAINT "AffiliateOverrideCommission_baseCommissionId_fkey"
  FOREIGN KEY ("baseCommissionId") REFERENCES "AffiliateCommission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
