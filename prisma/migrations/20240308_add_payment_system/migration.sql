-- AddPaymentSystem
-- This migration adds the payment and points mall system tables

-- Create PaymentProduct table
CREATE TABLE "PaymentProduct" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'points',
    price DOUBLE PRECISION NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    "periodDays" INTEGER,
    features TEXT,
    "stripePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Payment table
CREATE TABLE "Payment" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    points INTEGER NOT NULL,
    "stripePaymentId" TEXT,
    "stripeSessionId" TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "completedAt" TIMESTAMP
);

-- Create indexes
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_status_idx" ON "Payment"(status);
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- Add foreign key constraint
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "PaymentProduct"(id) ON DELETE RESTRICT;

-- Seed initial payment products
INSERT INTO "PaymentProduct" (code, name, description, type, price, points, "sortOrder") VALUES
('points_100', '100 积分', '100 积分，用于解锁高级功能', 'points', 0.99, 100, 1),
('points_500', '500 积分', '500 积分，享受9折优惠', 'points', 4.49, 500, 2),
('points_1000', '1000 积分', '1000 积分，享受85折优惠', 'points', 7.99, 1000, 3),
('points_3000', '3000 积分', '3000 积分，享受8折优惠', 'points', 19.99, 3000, 4),
('vip_monthly', 'VIP 月卡', '解锁所有VIP功能，包括无限AI对话、高级命盘解读等', 'subscription', 4.99, 0, 10),
('vip_yearly', 'VIP 年卡', '解锁所有VIP功能，享受年卡优惠', 'subscription', 39.99, 0, 11)
ON CONFLICT (code) DO NOTHING;

-- Update User model to include payments relation (done via migration)
-- Note: This is just documentation, PostgreSQL doesn't need explicit FK from User to Payment
