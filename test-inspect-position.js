/**
 * Inspect a specific closed TradeLocker position and dump ALL raw fields
 * Target trade:
 *   Instrument : NAS100
 *   Position ID: 7277816997840521702
 *   Order ID   : 7277816997883345529
 *   Entry Time : 2026/02/27 20:02:15 EET
 *   Exit Time  : 2026/02/27 20:14:23 EET
 *   Side       : Sell  |  Amount: 0.19
 *   Entry Price: 24,876.12  |  Exit Price: 24,869.41
 *   SL Price   : 24,941.98  |  TP Price: -
 *   Fee: -$0.19  |  Swap: $0.00  |  P&L: $1.27  |  Net P&L: $1.08
 */

import * as svc from './server/services/tradelocker.js'

const EMAIL      = 'kukunisalex@gmail.com'
const PASSWORD   = '6w+U^hgbm?'
const SERVER     = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID  = '692284'

// IDs we are hunting for (stored as strings in the API)
const TARGET_POSITION_ID = '7277816997840521702'
const TARGET_ORDER_ID    = '7277816997883345529'

// EET entry/exit timestamps converted to UTC ms (EET = UTC+2 in Feb)
// Entry 2026-02-27 20:02:15 EET = 18:02:15 UTC
// Exit  2026-02-27 20:14:23 EET = 18:14:23 UTC
const ENTRY_UTC_MS = new Date('2026-02-27T18:02:15Z').getTime()
const EXIT_UTC_MS  = new Date('2026-02-27T18:14:23Z').getTime()

function printDivider(char = '─', len = 100) { console.log(char.repeat(len)) }

function dumpRaw(label, obj) {
  printDivider()
  console.log(`\n📦 ${label}\n`)
  // Show both named keys and numeric-indexed keys
  const keys = Object.keys(obj)
  keys.forEach(k => {
    const v = obj[k]
    console.log(`  [${k.padEnd(35)}] = ${JSON.stringify(v)}`)
  })

  // Extra: scan numeric indices 0..30 explicitly
  console.log('\n  --- Numeric index scan [0..30] ---')
  for (let i = 0; i <= 30; i++) {
    const v = obj[i] ?? obj[String(i)]
    if (v !== undefined && v !== null && v !== '') {
      console.log(`  [${String(i).padEnd(3)}] = ${JSON.stringify(v)}`)
    }
  }
  printDivider()
}

function tradeMatches(t) {
  const keys = Object.keys(t)

  // Check every key and numeric index for either ID
  for (const k of keys) {
    const v = String(t[k] ?? '')
    if (v === TARGET_POSITION_ID || v === TARGET_ORDER_ID) return true
  }
  for (let i = 0; i <= 20; i++) {
    const v = String(t[i] ?? t[String(i)] ?? '')
    if (v === TARGET_POSITION_ID || v === TARGET_ORDER_ID) return true
  }

  // Fallback: match by entry/exit timestamps (±30 seconds)
  for (const k of keys) {
    const ms = Number(t[k])
    if (!isNaN(ms) && (
      Math.abs(ms - ENTRY_UTC_MS) < 30_000 ||
      Math.abs(ms - EXIT_UTC_MS)  < 30_000
    )) return true
  }

  return false
}

async function main() {
  try {
    // ── 1. Authenticate ────────────────────────────────────────────────────
    console.log('\n🔐  Authenticating with TradeLocker...')
    const auth = await svc.authenticateTradeLocker(EMAIL, PASSWORD, SERVER, ENVIRONMENT)
    console.log('✅  Auth OK — token expires:', auth.expiresAt)

    // ── 2. Resolve accNum ─────────────────────────────────────────────────
    const accounts = await svc.getTradeLockerAccounts(auth.accessToken, ENVIRONMENT)
    const account  = accounts.find(a => (a.accountId || a.id) === ACCOUNT_ID) || accounts[0]
    const accNum   = parseInt(account?.accNum ?? 0, 10)
    console.log(`\n📋  Using account: id=${ACCOUNT_ID}  accNum=${accNum}`)

    // ── 3. Fetch trade config (field names) ───────────────────────────────
    console.log('\n🗂️   Fetching trade config...')
    const config = await svc.getTradeConfig(auth.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT)
    if (config) {
      console.log('\n📐  Trade config (field definitions):')
      console.log(JSON.stringify(config, null, 2))
    } else {
      console.log('  ⚠️  No config returned — field names may be purely numeric indices.')
    }

    // ── 4. Fetch all instruments (for symbol lookup) ──────────────────────
    console.log('\n🎯  Fetching instrument list...')
    const instrumentMap = await svc.getAllInstruments(auth.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT)
    console.log(`  ${instrumentMap.size} instruments loaded`)

    // ── 5. Fetch raw closed positions (today only to keep it fast) ─────────
    console.log('\n📥  Fetching closed positions for 2026-02-27...')
    const startDate = '2026-02-27T00:00:00Z'
    const endDate   = '2026-02-28T00:00:00Z'
    const positions = await svc.getClosedPositions(
      auth.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT, startDate, endDate
    )
    console.log(`  ${positions.length} trade(s) returned`)

    // ── 6. Find the specific trade ─────────────────────────────────────────
    const match = positions.find(tradeMatches)

    if (!match) {
      console.log('\n⚠️  Target trade NOT found in today\'s results. Scanning all history...')
      const all = await svc.getClosedPositions(auth.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT)
      console.log(`  Total history: ${all.length} trade(s)`)
      const match2 = all.find(tradeMatches)
      if (!match2) {
        console.log('\n❌  Trade not found by Position/Order ID or timestamp.')
        console.log('    Dumping the 3 most recent trades for inspection:\n')
        all.slice(0, 3).forEach((t, i) => dumpRaw(`Recent trade #${i + 1}`, t))
        return
      }
      inspectTrade(match2, instrumentMap)
    } else {
      inspectTrade(match, instrumentMap)
    }

  } catch (err) {
    console.error('\n❌  Fatal error:', err.message)
    console.error(err.stack)
    process.exit(1)
  }
}

function inspectTrade(raw, instrumentMap) {
  console.log('\n\n✅  FOUND TARGET TRADE\n')

  // ── A. Full raw dump ───────────────────────────────────────────────────
  dumpRaw('RAW API RESPONSE (all keys)', raw)

  // ── B. Normalised output ───────────────────────────────────────────────
  const norm = svc.normalizeTradeLockerTrade(raw)
  console.log('\n🔧  NORMALISED (via normalizeTradeLockerTrade):')
  console.log(JSON.stringify(norm, null, 2))

  // ── C. Instrument symbol ───────────────────────────────────────────────
  const instId = String(norm.tradableInstrumentId || '')
  const symbol = instrumentMap.get(instId) || null
  console.log(`\n🏷️   Instrument ID: ${instId}   →   Symbol: ${symbol ?? '(not found in map)'}`)

  // ── D. Timestamp decoding ──────────────────────────────────────────────
  console.log('\n⏱️   Timestamp decoding:')
  ;['openTime', 'closeTime'].forEach(field => {
    const ms = Number(norm[field])
    if (!isNaN(ms) && ms > 0) {
      const d = new Date(ms)
      console.log(`  ${field}: raw=${norm[field]}  →  UTC: ${d.toISOString()}  |  EET (+2): ${
        new Date(ms + 2 * 3600_000).toISOString().replace('T', ' ').replace('Z', ' EET')
      }`)
    } else {
      console.log(`  ${field}: ${norm[field]} (could not parse)`)
    }
  })

  // ── E. Expected vs actual field mapping ────────────────────────────────
  console.log('\n\n📊  FIELD MAPPING SUMMARY (Expected → Actual)\n')
  const rows = [
    ['Instrument/Symbol',  symbol ?? `instId=${instId}`,            'NAS100'],
    ['Side (type)',        norm.type,                                'sell'],
    ['Order type',         norm.orderType,                           'market'],
    ['Amount (volume)',    norm.volume,                              0.19],
    ['Entry Price',        norm.openPrice,                           24876.12],
    ['Exit Price',         norm.closePrice,                          24869.41],
    ['SL Price',           norm.stopPrice,                           24941.98],
    ['TP Price',           norm.takeProfit,                          null],
    ['Fee (commission)',   norm.commission,                          -0.19],
    ['Swap',               norm.swap,                                0.00],
    ['Gross P&L',          norm.profit,                              1.27],
    ['Net P&L',            norm.netProfit,                           1.08],
    ['Order ID (ticket)',  norm.ticket,                              TARGET_ORDER_ID],
    ['Position ID',        norm.positionId,                          TARGET_POSITION_ID],
    ['Open time (UTC)',    norm.openTime  ? new Date(Number(norm.openTime)).toISOString()  : null, '2026-02-27T18:02:15.000Z'],
    ['Close time (UTC)',   norm.closeTime ? new Date(Number(norm.closeTime)).toISOString() : null, '2026-02-27T18:14:23.000Z'],
  ]

  const maxLabel = Math.max(...rows.map(r => String(r[0]).length))
  rows.forEach(([label, actual, expected]) => {
    const ok = String(actual) === String(expected) ? '✅' : (actual !== null && actual !== undefined && actual !== 0 && actual !== '' ? '⚠️ ' : '❌')
    console.log(
      `  ${ok}  ${String(label).padEnd(maxLabel + 2)}  actual=${JSON.stringify(actual)}  expected=${JSON.stringify(expected)}`
    )
  })

  // ── F. Raw index values for the array format ───────────────────────────
  const isArray = Object.keys(raw).every(k => !isNaN(parseInt(k)))
  if (isArray) {
    console.log('\n\n📐  ARRAY FORMAT — index → inferred meaning:')
    const meanings = {
      0: 'Order ID / ticket',
      1: 'Account num OR Instrument ID',
      2: 'Position ID',
      3: 'Volume / Amount',
      4: 'Side (buy/sell)',
      5: 'Order type (market/limit)',
      6: 'Status',
      7: 'Volume (duplicate?)',
      8: 'Entry (open) price',
      9: 'Exit (close) price',
      10: 'Stop Loss price',
      11: 'Time in force',
      12: 'Take Profit price',
      13: 'Open/entry timestamp (ms)',
      14: 'Close/exit timestamp (ms)',
      15: 'Boolean flag',
      16: 'Parent order ID',
      17: 'Price (limit order price)',
      18: 'Stop loss type',
      19: 'Swap',
      20: 'Commission / Fee',
      21: 'Realized P&L',
    }
    for (let i = 0; i <= 25; i++) {
      const v = raw[i] ?? raw[String(i)]
      if (v !== undefined && v !== null && v !== '') {
        console.log(`  [${String(i).padEnd(2)}] = ${String(v).padEnd(25)}  ← ${meanings[i] ?? '?'}`)
      }
    }
  }

  console.log('\n\n✅  Done.\n')
}

main()
