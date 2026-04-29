-- Add unique constraint for creem checkout id to harden payment idempotency.
-- Keep only one row per non-null checkout id before creating the unique index.
WITH duplicated AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "creemCheckoutId"
      ORDER BY
        CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
        "completedAt" DESC NULLS LAST,
        "createdAt" DESC,
        id DESC
    ) AS rn
  FROM "Payment"
  WHERE "creemCheckoutId" IS NOT NULL
)
DELETE FROM "Payment"
WHERE id IN (
  SELECT id
  FROM duplicated
  WHERE rn > 1
);

CREATE UNIQUE INDEX "Payment_creemCheckoutId_key" ON "Payment"("creemCheckoutId");
