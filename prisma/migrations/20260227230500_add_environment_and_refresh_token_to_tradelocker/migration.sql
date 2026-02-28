-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "tradelockerTradeId" TEXT;

-- CreateTable
CREATE TABLE "TradeLockerAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'live',
    "accountId" TEXT,
    "accNum" INTEGER,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeLockerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeLockerAccount_userId_key" ON "TradeLockerAccount"("userId");

-- CreateIndex
CREATE INDEX "TradeLockerAccount_userId_idx" ON "TradeLockerAccount"("userId");

-- CreateIndex
CREATE INDEX "Trade_tradelockerTradeId_idx" ON "Trade"("tradelockerTradeId");

-- AddForeignKey
ALTER TABLE "TradeLockerAccount" ADD CONSTRAINT "TradeLockerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
