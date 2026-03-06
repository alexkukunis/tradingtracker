/*
  Warnings:

  - You are about to drop the column `tradelockerTradeId` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the `TradeLockerAccount` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TradeLockerAccount" DROP CONSTRAINT "TradeLockerAccount_userId_fkey";

-- DropIndex
DROP INDEX "Trade_tradelockerTradeId_idx";

-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "tradelockerTradeId",
ADD COLUMN     "instrument" TEXT;

-- DropTable
DROP TABLE "TradeLockerAccount";
