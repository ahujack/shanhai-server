-- 成就定义表
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

-- 用户成就关联表
CREATE TABLE IF NOT EXISTS "UserAchievement" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE("userId", "achievementId")
);

-- 用户积分表
CREATE TABLE IF NOT EXISTS "UserPoints" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT UNIQUE NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "availablePoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 积分记录表
CREATE TABLE IF NOT EXISTS "PointRecord" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 插入成就数据
INSERT INTO "Achievement" (code, name, description, icon, category, requirement, points) VALUES
('login_1', '初次登录', '首次登录山海灵境', '🌟', 'login', 1, 10),
('login_3', '连续登录', '连续登录3天', '🔥', 'login', 3, 30),
('login_7', '一周之约', '连续登录7天', '💫', 'login', 7, 70),
('login_30', '月度签到', '连续登录30天', '🏆', 'login', 30, 300),
('draw_1', '初试手气', '完成首次抽签', '🎯', 'draw', 1, 10),
('draw_10', '抽签达人', '累计抽签10次', '🎰', 'draw', 10, 50),
('draw_50', '运气之王', '累计抽签50次', '👑', 'draw', 50, 200),
('chart_1', '初识命盘', '创建首个命盘', '📊', 'chart', 1, 20),
('chart_3', '多面探索', '创建3个命盘', '🔮', 'chart', 3, 60),
('chat_1', '初次对话', '与灵伴首次对话', '💬', 'chat', 1, 5),
('chat_50', '灵伴密友', '累计对话50次', '🧙', 'chat', 50, 100),
('chat_200', '心灵导师', '累计对话200次', '🌈', 'chat', 200, 300),
('vip_1', 'VIP体验', '首次开通VIP', '💎', 'vip', 1, 50),
('premium_1', '高级会员', '升级为高级会员', '⭐', 'vip', 1, 100)
ON CONFLICT (code) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS "Achievement_category_idx" ON "Achievement"(category);
CREATE INDEX IF NOT EXISTS "UserAchievement_userId_idx" ON "UserAchievement"("userId");
CREATE INDEX IF NOT EXISTS "PointRecord_userId_idx" ON "PointRecord"("userId");
CREATE INDEX IF NOT EXISTS "PointRecord_createdAt_idx" ON "PointRecord"("createdAt");
