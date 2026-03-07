-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "intent" TEXT,
    "personaId" TEXT,
    "mood" TEXT,
    "artifacts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZiAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "zi" TEXT NOT NULL,
    "pressure" TEXT,
    "pressureInterpretation" TEXT,
    "stability" TEXT,
    "stabilityInterpretation" TEXT,
    "structure" TEXT,
    "structureInterpretation" TEXT,
    "continuity" TEXT,
    "continuityInterpretation" TEXT,
    "overallStyle" TEXT,
    "personalityInsights" TEXT,
    "interpretation" TEXT,
    "coldReadings" TEXT,
    "followUpQuestions" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "category" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ZiAnalysis_userId_idx" ON "ZiAnalysis"("userId");

-- CreateIndex
CREATE INDEX "ZiAnalysis_createdAt_idx" ON "ZiAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "Reading_userId_idx" ON "Reading"("userId");

-- CreateIndex
CREATE INDEX "Reading_category_idx" ON "Reading"("category");

-- CreateIndex
CREATE INDEX "Reading_createdAt_idx" ON "Reading"("createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZiAnalysis" ADD CONSTRAINT "ZiAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
