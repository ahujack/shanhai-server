-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT,
    "avatar" TEXT,
    "phone" TEXT,
    "birthDate" TEXT,
    "birthTime" TEXT,
    "gender" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "location" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "membership" TEXT NOT NULL DEFAULT 'free',
    "googleId" TEXT,
    "facebookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaziChart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "birthTime" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "yearGanZhi" TEXT NOT NULL,
    "monthGanZhi" TEXT NOT NULL,
    "dayGanZhi" TEXT NOT NULL,
    "hourGanZhi" TEXT NOT NULL,
    "dayMaster" TEXT NOT NULL,
    "sun" TEXT NOT NULL,
    "moon" TEXT NOT NULL,
    "wuxingStrength" TEXT NOT NULL,
    "personalityTraits" TEXT NOT NULL,
    "fortuneSummary" TEXT NOT NULL,
    "suggestions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaziChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fortune" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "zodiac" TEXT,
    "overall" TEXT NOT NULL,
    "love" TEXT NOT NULL,
    "career" TEXT NOT NULL,
    "wealth" TEXT NOT NULL,
    "health" TEXT NOT NULL,
    "luckyColor" TEXT,
    "luckyNumber" TEXT,
    "luckyDirection" TEXT,
    "advice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fortune_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_facebookId_key" ON "User"("facebookId");

-- CreateIndex
CREATE UNIQUE INDEX "BaziChart_userId_key" ON "BaziChart"("userId");

-- CreateIndex
CREATE INDEX "Fortune_userId_idx" ON "Fortune"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Fortune_userId_date_key" ON "Fortune"("userId", "date");

-- AddForeignKey
ALTER TABLE "BaziChart" ADD CONSTRAINT "BaziChart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fortune" ADD CONSTRAINT "Fortune_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
