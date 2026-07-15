ALTER TABLE "AffiliatePartner"
  ADD COLUMN "dashboardTokenHash" TEXT,
  ADD COLUMN "settlementCycle" TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN "minimumPayout" DOUBLE PRECISION NOT NULL DEFAULT 50;
