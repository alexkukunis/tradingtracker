/**
 * One-time backfill: reads SL/TP from the pipe-separated notes field
 * of all existing TradeLocker trades and writes them to the new
 * stopLoss / takeProfit columns.
 *
 * Run: node backfill_sl_tp.mjs
 */

import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'

// Load .env
try {
  const envFile = readFileSync(new URL('./.env', import.meta.url), 'utf8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
} catch (e) {
  console.warn('Could not load .env:', e.message)
}

const prisma = new PrismaClient()

function parseSlTp(notes) {
  if (!notes) return { stopLoss: null, takeProfit: null }
  const parts = notes.split(' | ')
  let stopLoss = null
  let takeProfit = null
  for (const part of parts) {
    if (part.startsWith('SL:')) {
      const v = part.replace('SL:', '').trim()
      if (v && v !== 'N/A') stopLoss = parseFloat(v) || null
    }
    if (part.startsWith('TP:')) {
      const v = part.replace('TP:', '').trim()
      if (v && v !== 'N/A') takeProfit = parseFloat(v) || null
    }
  }
  return { stopLoss, takeProfit }
}

;(async () => {
  // Only backfill TradeLocker trades that still have null SL/TP
  const trades = await prisma.trade.findMany({
    where: {
      tradelockerTradeId: { not: null },
      OR: [{ stopLoss: null }, { takeProfit: null }]
    },
    select: { id: true, notes: true, stopLoss: true, takeProfit: true }
  })

  console.log(`Found ${trades.length} TradeLocker trades to backfill...`)

  let updated = 0
  for (const trade of trades) {
    const { stopLoss, takeProfit } = parseSlTp(trade.notes)
    // Only update if at least one value changed
    if (stopLoss === trade.stopLoss && takeProfit === trade.takeProfit) continue
    await prisma.trade.update({
      where: { id: trade.id },
      data: { stopLoss, takeProfit }
    })
    updated++
  }

  console.log(`✅ Backfilled ${updated} trades with SL/TP values.`)
  await prisma.$disconnect()
})()
