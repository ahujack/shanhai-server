-- CreateTable
CREATE TABLE "DestinyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "title" TEXT NOT NULL DEFAULT '深度命运报告',
    "payload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestinyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DestinyReport_paymentId_key" ON "DestinyReport"("paymentId");

-- CreateIndex
CREATE INDEX "DestinyReport_userId_idx" ON "DestinyReport"("userId");

-- CreateIndex
CREATE INDEX "DestinyReport_status_idx" ON "DestinyReport"("status");

-- CreateIndex
CREATE INDEX "DestinyReport_createdAt_idx" ON "DestinyReport"("createdAt");

-- AddForeignKey
ALTER TABLE "DestinyReport" ADD CONSTRAINT "DestinyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestinyReport" ADD CONSTRAINT "DestinyReport_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
