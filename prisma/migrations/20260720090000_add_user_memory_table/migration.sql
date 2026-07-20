CREATE TABLE IF NOT EXISTS "UserMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "sourceMessageId" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserMemory_userId_type_key_key" ON "UserMemory"("userId", "type", "key");
CREATE INDEX IF NOT EXISTS "UserMemory_userId_idx" ON "UserMemory"("userId");
CREATE INDEX IF NOT EXISTS "UserMemory_type_idx" ON "UserMemory"("type");
CREATE INDEX IF NOT EXISTS "UserMemory_lastSeenAt_idx" ON "UserMemory"("lastSeenAt");

ALTER TABLE "UserMemory"
  ADD CONSTRAINT "UserMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
