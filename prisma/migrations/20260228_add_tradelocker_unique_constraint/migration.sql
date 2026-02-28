-- First remove any duplicate (userId, tradelockerTradeId) rows, keeping the earliest one.
-- This is safe because tradelockerTradeId duplicates are exact data duplicates.
DELETE FROM "Trade"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "userId", "tradelockerTradeId"
             ORDER BY "createdAt" ASC
           ) AS rn
    FROM "Trade"
    WHERE "tradelockerTradeId" IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- CreateIndex: unique constraint on (userId, tradelockerTradeId).
-- PostgreSQL treats NULL as distinct in unique indexes, so manually-entered
-- trades (tradelockerTradeId = NULL) are never affected by this constraint.
CREATE UNIQUE INDEX "Trade_userId_tradelockerTradeId_key"
  ON "Trade"("userId", "tradelockerTradeId")
  WHERE "tradelockerTradeId" IS NOT NULL;
