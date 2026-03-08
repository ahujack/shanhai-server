-- AddReferralSystem
-- Add referral fields to User table

ALTER TABLE "User" ADD COLUMN "referredBy" TEXT;
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;

-- Create unique index for referral code (allow nulls)
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode") WHERE "referralCode" IS NOT NULL;

-- Generate referral codes for existing users (optional, can be done on demand)
UPDATE "User" SET "referralCode" = substr(md5(random()::text), 1, 8) WHERE "referralCode" IS NULL;
