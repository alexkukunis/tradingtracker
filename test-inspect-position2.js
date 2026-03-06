/**
 * Part 2: Find the OPENING order (Sell 0.19 at 24876.12) and
 * check the positionsHistory endpoint for P&L / fee / swap data.
 *
 * TradeLocker official config (from /trade/config) maps ordersHistory arrays as:
 *  [0]=id  [1]=tradableInstrumentId  [2]=routeId  [3]=qty  [4]=side  [5]=type
 *  [6]=status  [7]=filledQty  [8]=avgPrice  [9]=price  [10]=stopPrice  [11]=validity
 *  [12]=expireDate  [13]=createdDate  [14]=lastModified  [15]=isOpen  [16]=positionId
 *  [17]=stopLoss  [18]=stopLossType  [19]=takeProfit  [20]=takeProfitType  [21]=strategyId
 */

import * as svc from './server/services/tradelocker.js'

const EMAIL       = 'kukunisalex@gmail.com'
const PASSWORD    = '6w+U^hgbm?'
const SERVER      = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID  = '692284'

const TARGET_OPEN_ORDER_ID   = '7277816997883345529'
const TARGET_CLOSE_ORDER_ID  = '7277816997883345530'
const TARGET_POSITION_ID_UI  = '7277816997840521702'
const TARGET_POSITION_ID_ALT = '7277816997840521701'

const BASE_URL = 'https://live.tradelocker.com/backend-api'

function printDivider(char = '─', len = 100) { console.log(char.repeat(len)) }

function labelledDump(label, trade) {
  printDivider('═')
  console.log(`\n🔍  ${label}\n`)
  printDivider()

  // Official field name mapping per /trade/config ordersHistoryConfig
  const FIELD_NAMES = {
    0: 'id (Order ID)',
    1: 'tradableInstrumentId',
    2: 'routeId',
    3: 'qty (volume)',
    4: 'side (buy/sell)',
    5: 'type (market/limit)',
    6: 'status',
    7: 'filledQty',
    8: 'avgPrice (entry price)',
    9: 'price (limit trigger)',
    10: 'stopPrice (stop trigger)',
    11: 'validity (timeInForce)',
    12: 'expireDate',
    13: 'createdDate (open timestamp ms)',
    14: 'lastModified (close timestamp ms)',
    15: 'isOpen',
    16: 'positionId',
    17: 'stopLoss ← SL Price',
    18: 'stopLossType',
    19: 'takeProfit ← TP Price',
    20: 'takeProfitType',
    21: 'strategyId (NOT P&L!)',
  }

  for (let i = 0; i <= 21; i++) {
    const raw = trade[i] ?? trade[String(i)]
    let decoded = ''
    // Decode timestamps
    if ((i === 13 || i === 14) && raw && !isNaN(Number(raw))) {
      const d = new Date(Number(raw))
      decoded = `  → UTC: ${d.toISOString()}  EET(+2): ${new Date(Number(raw) + 7200000).toISOString().replace('T',' ').replace('Z',' EET')}`
    }
    const label = FIELD_NAMES[i] || '?'
    console.log(`  [${String(i).padEnd(2)}] ${label.padEnd(38)} = ${JSON.stringify(raw)}${decoded}`)
  }
  printDivider()
}

async function main() {
  // ── Auth ────────────────────────────────────────────────────────────────
  console.log('\n🔐  Authenticating...')
  const auth = await svc.authenticateTradeLocker(EMAIL, PASSWORD, SERVER, ENVIRONMENT)
  const accounts = await svc.getTradeLockerAccounts(auth.accessToken, ENVIRONMENT)
  const account  = accounts.find(a => (a.accountId || a.id) === ACCOUNT_ID) || accounts[0]
  const accNum   = parseInt(account?.accNum ?? 0, 10)
  console.log(`✅  accNum=${accNum}`)

  const headers = {
    'Authorization': `Bearer ${auth.accessToken}`,
    'accNum': String(accNum),
    'Content-Type': 'application/json'
  }

  // ── 1. Load all trades for today ────────────────────────────────────────
  console.log('\n📥  Fetching ordersHistory for 2026-02-27...')
  const allTrades = await svc.getClosedPositions(
    auth.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT,
    '2026-02-27T00:00:00Z', '2026-02-28T00:00:00Z'
  )
  console.log(`  ${allTrades.length} orders returned`)

  // ── 2. Find both legs by order ID ───────────────────────────────────────
  const openingOrder = allTrades.find(t => {
    const id = String(t[0] ?? t['0'] ?? '')
    return id === TARGET_OPEN_ORDER_ID
  })
  const closingOrder = allTrades.find(t => {
    const id = String(t[0] ?? t['0'] ?? '')
    return id === TARGET_CLOSE_ORDER_ID
  })

  // Also look by positionId field ([16])
  const byPositionId = allTrades.filter(t => {
    const pid = String(t[16] ?? t['16'] ?? '')
    return pid === TARGET_POSITION_ID_UI || pid === TARGET_POSITION_ID_ALT
  })

  console.log(`\n  Opening order (${TARGET_OPEN_ORDER_ID}):  ${openingOrder ? 'FOUND ✅' : 'NOT FOUND ❌'}`)
  console.log(`  Closing order (${TARGET_CLOSE_ORDER_ID}): ${closingOrder ? 'FOUND ✅' : 'NOT FOUND ❌'}`)
  console.log(`  Orders with positionId matching UI:     ${byPositionId.length} found`)

  if (openingOrder) labelledDump(`OPENING ORDER (Sell 0.19 at 24876.12)  — id: ${TARGET_OPEN_ORDER_ID}`, openingOrder)
  if (closingOrder) labelledDump(`CLOSING ORDER (Buy at 24869.5)          — id: ${TARGET_CLOSE_ORDER_ID}`, closingOrder)

  if (byPositionId.length > 0) {
    console.log(`\n📎  All orders linked to this position via [16]=positionId:`)
    byPositionId.forEach((t, i) => {
      labelledDump(`Position-linked order #${i + 1}`, t)
    })
  }

  // ── 3. If opening order not found, search by sell side near entry price ──
  if (!openingOrder) {
    console.log('\n🔍  Opening order not found by ID — searching by price/side/time...')
    const candidates = allTrades.filter(t => {
      const side       = String(t[4] ?? t['4'] ?? '').toLowerCase()
      const avgPrice   = parseFloat(t[8] ?? t['8'] ?? 0)
      const createdMs  = Number(t[13] ?? t['13'] ?? 0)
      // Sell, near 24876.12, created around 18:02 UTC (±5 min)
      return side === 'sell' &&
             Math.abs(avgPrice - 24876.12) < 5 &&
             Math.abs(createdMs - 1772215335000) < 300_000
    })
    console.log(`  ${candidates.length} candidate(s) found`)
    candidates.forEach((t, i) => labelledDump(`Candidate opening order #${i + 1}`, t))
  }

  // ── 4. Check positionsHistory endpoint for P&L / fees ───────────────────
  console.log('\n\n📊  Checking positionsHistory endpoint...')
  const posHistUrl = `${BASE_URL}/trade/accounts/${ACCOUNT_ID}/positionsHistory?startTime=2026-02-27T00%3A00%3A00Z&endTime=2026-02-28T00%3A00%3A00Z`
  try {
    const res = await fetch(posHistUrl, { method: 'GET', headers })
    console.log(`  Status: ${res.status}`)
    if (res.ok) {
      const data = await res.json()
      const d = data.d || data
      console.log('  Top-level keys:', Object.keys(d))
      const arr = d.positionsHistory || d.positions || d.history || (Array.isArray(d) ? d : [])
      console.log(`  ${arr.length} position history records`)
      if (arr.length > 0) {
        // Find our position
        const match = arr.find(p => {
          const keys = Object.keys(p)
          // check for our target IDs in every value
          for (const k of keys) {
            const v = String(p[k] ?? '')
            if (v === TARGET_POSITION_ID_UI || v === TARGET_POSITION_ID_ALT ||
                v === TARGET_OPEN_ORDER_ID  || v === TARGET_CLOSE_ORDER_ID) return true
          }
          return false
        })
        if (match) {
          printDivider('═')
          console.log('\n✅  MATCHED position in positionsHistory:\n')
          console.log(JSON.stringify(match, null, 2))
          printDivider('═')
        } else {
          console.log('\n  Target not found; dumping first 3 records:')
          arr.slice(0, 3).forEach((p, i) => {
            console.log(`\n  --- positionsHistory[${i}] ---`)
            console.log(JSON.stringify(p, null, 2))
          })
        }
      }
    } else {
      const text = await res.text()
      console.log('  Response:', text.slice(0, 300))
    }
  } catch (err) {
    console.log('  Error:', err.message)
  }

  // ── 5. Check executions/fills endpoint (fee & swap often live here) ──────
  console.log('\n\n💰  Checking executions/filledOrders endpoint...')
  const fillUrls = [
    `${BASE_URL}/trade/accounts/${ACCOUNT_ID}/executions?startTime=2026-02-27T00%3A00%3A00Z&endTime=2026-02-28T00%3A00%3A00Z`,
    `${BASE_URL}/trade/accounts/${ACCOUNT_ID}/filledOrders?startTime=2026-02-27T00%3A00%3A00Z&endTime=2026-02-28T00%3A00%3A00Z`,
  ]
  for (const url of fillUrls) {
    try {
      const res = await fetch(url, { method: 'GET', headers })
      console.log(`\n  ${url.split('/').pop().split('?')[0]} → status: ${res.status}`)
      if (res.ok) {
        const data = await res.json()
        const d = data.d || data
        console.log('  Keys:', Object.keys(d))
        const arr = d.executions || d.filledOrders || d.fills || d.orders || (Array.isArray(d) ? d : [])
        console.log(`  ${arr.length} records`)
        if (arr.length > 0) {
          // Find one matching our order IDs
          const match = arr.find(e => {
            const keys = Object.keys(e)
            for (const k of keys) {
              const v = String(e[k] ?? '')
              if (v === TARGET_OPEN_ORDER_ID || v === TARGET_CLOSE_ORDER_ID ||
                  v === TARGET_POSITION_ID_UI || v === TARGET_POSITION_ID_ALT) return true
            }
            // Also check numeric indices
            for (let i = 0; i <= 10; i++) {
              const v = String(e[i] ?? e[String(i)] ?? '')
              if (v === TARGET_OPEN_ORDER_ID || v === TARGET_CLOSE_ORDER_ID ||
                  v === TARGET_POSITION_ID_UI || v === TARGET_POSITION_ID_ALT) return true
            }
            return false
          })
          if (match) {
            console.log('  ✅ Found matching record:')
            console.log(JSON.stringify(match, null, 2))
          } else {
            console.log('  First record for structure reference:')
            console.log(JSON.stringify(arr[0], null, 2))
          }
        }
      } else {
        const text = await res.text()
        console.log('  Response:', text.slice(0, 200))
      }
    } catch (err) {
      console.log('  Error:', err.message)
    }
  }

  // ── 6. Summary of what the correct mapping should be ────────────────────
  console.log('\n\n' + '═'.repeat(100))
  console.log('📋  OFFICIAL FIELD INDEX MAPPING (from /trade/config ordersHistoryConfig)')
  console.log('═'.repeat(100))
  const correctMap = [
    [0,  'id',               'Order ID / ticket'],
    [1,  'tradableInstrumentId', 'Instrument ID → use to look up symbol in /instruments'],
    [2,  'routeId',          'Route ID (broker routing — NOT positionId!)'],
    [3,  'qty',              'Volume / Amount'],
    [4,  'side',             'Side: "buy" or "sell"'],
    [5,  'type',             'Order type: "market", "limit", "stop"'],
    [6,  'status',           'Status: "Filled", "Cancelled", etc.'],
    [7,  'filledQty',        'Filled quantity'],
    [8,  'avgPrice',         'Average fill price = Entry price'],
    [9,  'price',            'Limit price (for limit orders)'],
    [10, 'stopPrice',        'Stop trigger price (for stop orders) ← NOT the SL price!'],
    [11, 'validity',         'Time in force (GTC, IOC, etc.)'],
    [12, 'expireDate',       'Order expiry date ← NOT takeProfit!'],
    [13, 'createdDate',      'Order creation timestamp (ms) = Entry time'],
    [14, 'lastModified',     'Last modified timestamp (ms) = Exit/fill time'],
    [15, 'isOpen',           'Is position still open'],
    [16, 'positionId',       'Position ID ← was incorrectly mapped as parentOrderId!'],
    [17, 'stopLoss',         'Stop Loss price ← SL Price! (was mapped as "price")'],
    [18, 'stopLossType',     'Stop Loss type'],
    [19, 'takeProfit',       'Take Profit price ← TP Price! (was mapped as "swap")'],
    [20, 'takeProfitType',   'Take Profit type (was mapped as "commission")'],
    [21, 'strategyId',       'Strategy ID ← NOT P&L! (was incorrectly used as profit)'],
  ]
  correctMap.forEach(([idx, fieldName, description]) => {
    console.log(`  [${String(idx).padEnd(2)}] ${fieldName.padEnd(25)} → ${description}`)
  })

  console.log('\n  ⚠️  P&L, Fee (commission), and Swap are NOT returned by ordersHistory.')
  console.log('      They must be calculated from price difference or fetched from another endpoint.')
  console.log('\n✅  Done.\n')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
