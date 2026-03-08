-- AddCheckInAndOtherTables
-- This migration adds CheckIn, Achievement, UserAchievement, UserPoints, PointRecord tables

-- CheckIn table (already in schema but not in database)
CREATE TABLE "CheckIn" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    date TEXT NOT NULL,
    streak INTEGER NOT NULL DEFAULT 1,
    points INTEGER NOT NULL DEFAULT 10,
    reward TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE("userId", date)
);

CREATE INDEX "CheckIn_userId_idx" ON "CheckIn"("userId");

-- Add foreign key for CheckIn
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

-- Achievement table (if not exists, this is idempotent)
CREATE TABLE IF NOT EXISTS "Achievement" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    category TEXT NOT NULL,
    requirement INTEGER NOT NULL DEFAULT 1,
    points INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Achievement_category_idx" ON "Achievement"(category);

-- UserAchievement table
CREATE TABLE IF NOT EXISTS "UserAchievement" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE("userId", "achievementId")
);

CREATE INDEX IF NOT EXISTS "UserAchievement_userId_idx" ON "UserAchievement"("userId");

ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" 
    FOREIGN KEY ("achievementId") REFERENCES "Achievement"(id) ON DELETE CASCADE;

-- UserPoints table
CREATE TABLE IF NOT EXISTS "UserPoints" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT UNIQUE NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "availablePoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE "UserPoints" ADD CONSTRAINT "UserPoints_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

-- PointRecord table
CREATE TABLE IF NOT EXISTS "PointRecord" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PointRecord_userId_idx" ON "PointRecord"("userId");
CREATE INDEX IF NOT EXISTS "PointRecord_createdAt_idx" ON "PointRecord"("createdAt");

ALTER TABLE "PointRecord" ADD CONSTRAINT "PointRecord_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

-- Seed initial achievements (idempotent)
INSERT INTO "Achievement" (code, name, description, category, requirement, points) VALUES
('login_1', '初次登录', '完成首次签到', 'login', 1, 10),
('login_3', '连续登录', '连续签到3天', 'login', 3, 30),
('login_7', '一周签到', '连续签到7天', 'login', 7, 70),
('login_30', '月度签到', '连续签到30天', 'login', 30, 300),
('first_draw', '初次占卜', '完成首次占卜', 'draw', 1, 20),
('draw_10', '占卜达人', '完成10次占卜', 'draw', 10, 100),
('first_chart', '命盘生成', '生成个人命盘', 'chart', 1, 50),
('chat_1', '开始对话', '进行首次AI对话', 'chat', 1, 10),
('chat_100', '聊天大师', '进行100次AI对话', 'chat', 100, 200)
ON CONFLICT (code) DO NOTHING;
