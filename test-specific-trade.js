/**
 * Test script to find and verify the specific trade from the user's example
 * Order ID: 7277816997883345529
 * Position ID: 7277816997840521702
 * Instrument: NAS100
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'
const ORDER_ID = '7277816997883345529'
const POSITION_ID = '7277816997840521702'

async function testSpecificTrade() {
  try {
    console.log('🔐 Authenticating...\n')
    const authResult = await tradelockerService.authenticateTradeLocker(
      EMAIL, PASSWORD, SERVER, ENVIRONMENT
    )

    const accounts = await tradelockerService.getTradeLockerAccounts(
      authResult.accessToken, ENVIRONMENT
    )
    const account = accounts.find(acc => (acc.accountId || acc.id) === ACCOUNT_ID) || accounts[0]
    const accNum = parseInt(account?.accNum || 0, 10)
    
    console.log('📊 Fetching trades...\n')
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    // Find the specific trade - search by both Order ID and Position ID
    let exampleTrade = closedPositions.find(trade => {
      const orderId = String(trade['0'] || trade[0] || '')
      return orderId === ORDER_ID
    })
    
    // If not found by Order ID, try Position ID
    if (!exampleTrade) {
      exampleTrade = closedPositions.find(trade => {
        const positionId = String(trade['2'] || trade[2] || '')
        return positionId === POSITION_ID
      })
    }
    
    // Also search for trades with NAS100 (instrument ID 3884) and similar prices
    if (!exampleTrade) {
      console.log('Searching for NAS100 trades with similar characteristics...')
      exampleTrade = closedPositions.find(trade => {
        const instId = String(trade['1'] || trade[1] || '')
        const volume = parseFloat(trade['3'] || trade[3] || 0)
        const side = (trade['4'] || trade[4] || '').toLowerCase()
        return instId === '3884' && Math.abs(volume - 0.19) < 0.01 && side === 'sell'
      })
    }

    if (!exampleTrade) {
      console.log(`❌ Could not find trade with Order ID: ${ORDER_ID} or Position ID: ${POSITION_ID}`)
      console.log('\nShowing first 3 trades for reference:')
      closedPositions.slice(0, 3).forEach((trade, idx) => {
        console.log(`\nTrade ${idx + 1}:`)
        console.log(`  Order ID: ${trade['0'] || trade[0]}`)
        console.log(`  Position ID: ${trade['2'] || trade[2]}`)
        console.log(`  Instrument ID: ${trade['1'] || trade[1]}`)
      })
      return
    }

    console.log(`✅ Found example trade!\n`)
    console.log('='.repeat(100))
    
    // Show raw data - show ALL fields including null/empty
    console.log('\n📋 RAW TRADE DATA (All Fields):')
    console.log('─'.repeat(100))
    for (let i = 0; i < 25; i++) {
      const val = exampleTrade[i] !== undefined ? exampleTrade[i] : exampleTrade[String(i)]
      const displayVal = val === null ? 'null' : val === undefined ? 'undefined' : val === '' ? '""' : JSON.stringify(val)
      console.log(`  [${i}]: ${displayVal}`)
    }
    
    // Also search for trades matching the user's example more closely
    console.log('\n\n🔍 SEARCHING FOR TRADES MATCHING USER EXAMPLE:')
    console.log('─'.repeat(100))
    console.log('Looking for: NAS100, Sell, Entry ~24876, Exit ~24869, SL ~24941\n')
    
    const matchingTrades = closedPositions.filter(trade => {
      const instId = String(trade['1'] || trade[1] || '')
      const side = (trade['4'] || trade[4] || '').toLowerCase()
      const entryPrice = parseFloat(trade['8'] || trade[8] || 0)
      const exitPrice = parseFloat(trade['9'] || trade[9] || 0)
      const slPrice = parseFloat(trade['10'] || trade[10] || 0)
      
      return instId === '3884' && // NAS100
             side === 'sell' &&
             Math.abs(entryPrice - 24876.12) < 100 && // Close to expected entry
             Math.abs(exitPrice - 24869.41) < 100 && // Close to expected exit
             Math.abs(slPrice - 24941.98) < 100 // Close to expected SL
    })
    
    if (matchingTrades.length > 0) {
      console.log(`Found ${matchingTrades.length} matching trade(s):\n`)
      matchingTrades.slice(0, 3).forEach((trade, idx) => {
        console.log(`\nMatch ${idx + 1}:`)
        console.log(`  Order ID: ${trade['0'] || trade[0]}`)
        console.log(`  Position ID: ${trade['2'] || trade[2]}`)
        console.log(`  Side: ${trade['4'] || trade[4]}`)
        console.log(`  Entry: ${trade['8'] || trade[8]}`)
        console.log(`  Exit: ${trade['9'] || trade[9]}`)
        console.log(`  SL: ${trade['10'] || trade[10]}`)
        console.log(`  TP: ${trade['12'] || trade[12]}`)
        console.log(`  Fee [20]: ${trade['20'] !== undefined ? trade['20'] : trade[20]}`)
        console.log(`  Swap [19]: ${trade['19'] !== undefined ? trade['19'] : trade[19]}`)
        console.log(`  Profit [21]: ${trade['21'] !== undefined ? trade['21'] : trade[21]}`)
        
        // Use the first matching trade
        if (idx === 0) {
          exampleTrade = trade
          console.log('\n  ✅ Using this trade for detailed analysis')
        }
      })
    } else {
      console.log('No exact matches found. Using the trade found by Order ID.')
    }

    // Normalize the trade
    const normalized = tradelockerService.normalizeTradeLockerTrade(exampleTrade)
    
    console.log('\n\n🔄 NORMALIZED DATA:')
    console.log('─'.repeat(100))
    console.log(`  Order ID:          ${normalized.ticket || 'N/A'}`)
    console.log(`  Position ID:       ${normalized.positionId || 'N/A'}`)
    console.log(`  Instrument ID:     ${normalized.tradableInstrumentId || 'N/A'}`)
    console.log(`  Volume:            ${normalized.volume || 'N/A'}`)
    console.log(`  Type (Side):       ${normalized.type || 'N/A'}`)
    console.log(`  Order Type:        ${normalized.orderType || 'N/A'}`)
    console.log(`  Status:            ${normalized.status || 'N/A'}`)
    console.log(`  Entry Price:       ${normalized.openPrice || 'N/A'}`)
    console.log(`  Exit Price:        ${normalized.closePrice || 'N/A'}`)
    console.log(`  SL Price:          ${normalized.stopPrice || 'N/A'}`)
    console.log(`  TP Price:          ${normalized.takeProfit || 'N/A'}`)
    console.log(`  Swap:              ${normalized.swap || 'N/A'}`)
    console.log(`  Commission:       ${normalized.commission || 'N/A'}`)
    console.log(`  Profit (P&L):      ${normalized.profit || 'N/A'}`)
    console.log(`  Net Profit:       ${normalized.netProfit || 'N/A'}`)
    
    // Format timestamps - handle invalid dates
    if (normalized.openTime) {
      try {
        const openTimeMs = typeof normalized.openTime === 'string' ? parseInt(normalized.openTime, 10) : Number(normalized.openTime)
        if (!isNaN(openTimeMs) && openTimeMs > 0 && openTimeMs < Number.MAX_SAFE_INTEGER) {
          const openDate = new Date(openTimeMs)
          if (!isNaN(openDate.getTime())) {
            console.log(`  Open Time:         ${openDate.toISOString()} (${openDate.toLocaleString('en-US', { timeZone: 'Europe/Sofia' })})`)
          } else {
            console.log(`  Open Time:         Invalid timestamp: ${normalized.openTime}`)
          }
        } else {
          console.log(`  Open Time:         Invalid timestamp value: ${normalized.openTime}`)
        }
      } catch (e) {
        console.log(`  Open Time:         Error parsing: ${normalized.openTime}`)
      }
    }
    if (normalized.closeTime) {
      try {
        const closeTimeMs = typeof normalized.closeTime === 'string' ? parseInt(normalized.closeTime, 10) : Number(normalized.closeTime)
        if (!isNaN(closeTimeMs) && closeTimeMs > 0 && closeTimeMs < Number.MAX_SAFE_INTEGER) {
          const closeDate = new Date(closeTimeMs)
          if (!isNaN(closeDate.getTime())) {
            console.log(`  Close Time:        ${closeDate.toISOString()} (${closeDate.toLocaleString('en-US', { timeZone: 'Europe/Sofia' })})`)
          } else {
            console.log(`  Close Time:        Invalid timestamp: ${normalized.closeTime}`)
          }
        } else {
          console.log(`  Close Time:        Invalid timestamp value: ${normalized.closeTime}`)
        }
      } catch (e) {
        console.log(`  Close Time:        Error parsing: ${normalized.closeTime}`)
      }
    }

    // Get instrument symbol
    console.log('\n\n🔍 FETCHING INSTRUMENT SYMBOL:')
    console.log('─'.repeat(100))
    const instrumentId = normalized.tradableInstrumentId
    if (instrumentId) {
      const allInstruments = await tradelockerService.getAllInstruments(
        authResult.accessToken,
        ACCOUNT_ID,
        accNum,
        ENVIRONMENT
      )
      const symbol = allInstruments.get(String(instrumentId))
      console.log(`  Instrument ID: ${instrumentId}`)
      console.log(`  Symbol: ${symbol || 'NOT FOUND'}`)
      
      // Transform the trade
      console.log('\n\n✨ TRANSFORMED TRADE (Ready for UI):')
      console.log('─'.repeat(100))
      const settings = { riskPercent: 2, riskReward: 3, startingBalance: 699.84 }
      const transformed = tradelockerService.transformTradeLockerTrade(
        exampleTrade,
        699.84,
        settings,
        symbol
      )
      
      console.log(`  Date:              ${transformed.date.toISOString()}`)
      console.log(`  Day:               ${transformed.day}`)
      console.log(`  P&L:               $${transformed.pnl}`)
      console.log(`  Open Balance:      $${transformed.openBalance}`)
      console.log(`  Close Balance:     $${transformed.closeBalance}`)
      console.log(`  % Gain:            ${transformed.percentGain}%`)
      console.log(`  Result:            ${transformed.result}`)
      console.log(`  TradeLocker ID:    ${transformed.tradelockerTradeId || 'N/A'}`)
      console.log(`\n  Notes:`)
      console.log(`  ${transformed.notes}`)
      
      // Parse notes to show what UI will extract
      console.log(`\n\n📝 NOTES PARSING (What UI Will Display):`)
      console.log('─'.repeat(100))
      const notesParts = transformed.notes.split(' | ')
      notesParts.forEach((part, idx) => {
        console.log(`  [${idx}] ${part}`)
      })
    }

    // Expected values from user's example
    console.log('\n\n✅ EXPECTED VALUES (From User Example):')
    console.log('─'.repeat(100))
    console.log(`  Instrument:        NAS100`)
    console.log(`  Entry Price:       24,876.12`)
    console.log(`  SL Price:          24,941.98`)
    console.log(`  TP Price:          - (not set)`)
    console.log(`  Exit Price:        24,869.41`)
    console.log(`  Fee:               -$0.19`)
    console.log(`  Swap:              $0.00`)
    console.log(`  P&L:               $1.27`)
    console.log(`  Net P&L:           $1.08`)
    console.log(`  Order ID:          ${ORDER_ID}`)
    console.log(`  Position ID:       ${POSITION_ID}`)

    console.log('\n' + '='.repeat(100))
    console.log('✅ Test complete!')
    console.log('='.repeat(100))

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testSpecificTrade()
