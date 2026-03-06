import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { getClosedPositions, groupPositionOrders } from './server/services/tradelocker.js'
import crypto from 'crypto'

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
} catch (e) {}

const prisma = new PrismaClient()

const TARGET_POSITION_ID = '7277816997840521399'

;(async () => {
  const user = await prisma.user.findUnique({
    where: { email: 'kukunisalex@gmail.com' },
    include: { tradelockerAccount: true }
  })
  const tl = user.tradelockerAccount

  const rawOrders = await getClosedPositions(tl.accessToken, tl.accountId, tl.accNum, tl.environment)

  const orders = rawOrders.filter(o => {
    const posId = String(o['16'] ?? o[16] ?? '').trim()
    return posId === TARGET_POSITION_ID
  })

  console.log(`\nFound ${orders.length} orders for position ${TARGET_POSITION_ID}:\n`)
  orders.forEach((o, i) => {
    const labels = {
      0:'orderId', 1:'tradableInstrumentId', 2:'routeId', 3:'qty', 4:'side',
      5:'type', 6:'status', 7:'filledQty', 8:'avgPrice', 9:'price',
      10:'stopPrice', 11:'validity', 12:'expireDate', 13:'createdDate(ms)',
      14:'lastModified(ms)', 15:'isOpen', 16:'positionId',
      17:'stopLoss [17] ← SL', 18:'stopLossType', 19:'takeProfit [19] ← TP',
      20:'takeProfitType', 21:'strategyId'
    }
    console.log(`── Order [${i}] ──────────────────────────`)
    Object.keys(o).forEach(k => console.log(`  [${k}] ${labels[k]||''} = ${JSON.stringify(o[k])}`))
    console.log()
  })

  // Also verify the grouped result
  console.log('\n── Grouped position result (after bracket-order fix) ──')
  const allOrders = await getClosedPositions(tl.accessToken, tl.accountId, tl.accNum, tl.environment)
  const grouped = groupPositionOrders(allOrders)
  const pos = grouped.find(p => String(p.positionId) === TARGET_POSITION_ID)
  if (pos) {
    console.log(`  SL: ${pos.stopPrice}`)
    console.log(`  TP: ${pos.takeProfit}`)
    console.log(`  entry: ${pos.openPrice}  exit: ${pos.exitPrice}`)
  } else {
    console.log('  Position not found in grouped results')
  }

  await prisma.$disconnect()
})()
