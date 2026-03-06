/**
 * Script to get the latest 5 trades from TradeLocker account
 * Shows all mapped fields including Instrument, Entry/Exit times, P&L, Fees, etc.
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function getLatestTrades() {
  try {
    console.log('🔐 Authenticating with TradeLocker...\n')
    const authResult = await tradelockerService.authenticateTradeLocker(
      EMAIL, PASSWORD, SERVER, ENVIRONMENT
    )
    console.log('✅ Authentication successful\n')

    const accounts = await tradelockerService.getTradeLockerAccounts(
      authResult.accessToken, ENVIRONMENT
    )
    const account = accounts.find(acc => (acc.accountId || acc.id) === ACCOUNT_ID) || accounts[0]
    const accNum = parseInt(account?.accNum || 0, 10)
    
    console.log(`📊 Account: ${account?.accountId || account?.id} (Acc# ${accNum})\n`)

    console.log('📈 Fetching closed positions...\n')
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    console.log(`Found ${closedPositions.length} total trades\n`)

    if (closedPositions.length === 0) {
      console.log('❌ No trades found')
      return
    }

    // Sort by close time (most recent first)
    const sortedPositions = [...closedPositions].sort((a, b) => {
      const timeA = a['14'] || a[14] || a.closeTime || a.CloseTime || a['13'] || a[13] || a.openTime || a.OpenTime || 0
      const timeB = b['14'] || b[14] || b.closeTime || b.CloseTime || b['13'] || b[13] || b.openTime || b.OpenTime || 0
      const numA = typeof timeA === 'string' ? parseInt(timeA) : (timeA || 0)
      const numB = typeof timeB === 'string' ? parseInt(timeB) : (timeB || 0)
      return numB - numA // Descending (newest first)
    })

    // Get latest 5 trades
    const latest5 = sortedPositions.slice(0, 5)

    console.log('='.repeat(120))
    console.log('📋 LATEST 5 TRADES FROM TRADELOCKER')
    console.log('='.repeat(120))
    console.log()

    // Collect unique instrument IDs
    const instrumentIdSet = new Set()
    for (const position of latest5) {
      const instrumentId = position.tradableInstrumentId || 
                          position.instrumentId || 
                          position.symbolId ||
                          position['1'] || 
                          position[1]
      if (instrumentId) {
        instrumentIdSet.add(String(instrumentId))
      }
    }

    // Fetch instrument symbols
    const instrumentSymbolMap = new Map()
    console.log(`🔍 Fetching instrument details for ${instrumentIdSet.size} unique instruments...\n`)
    
    for (const instrumentId of instrumentIdSet) {
      try {
        const instrumentDetails = await tradelockerService.getInstrumentDetails(
          authResult.accessToken,
          instrumentId,
          accNum,
          ENVIRONMENT
        )
        if (instrumentDetails && instrumentDetails.symbol) {
          instrumentSymbolMap.set(instrumentId, instrumentDetails.symbol)
          console.log(`  ✅ ${instrumentId} → ${instrumentDetails.symbol}`)
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to fetch instrument ${instrumentId}: ${error.message}`)
      }
    }
    console.log()

    // Display each trade with all mapped fields
    for (let i = 0; i < latest5.length; i++) {
      const position = latest5[i]
      const normalized = tradelockerService.normalizeTradeLockerTrade(position)
      
      // Get instrument symbol
      const instrumentId = position.tradableInstrumentId || 
                          position.instrumentId || 
                          position.symbolId ||
                          position['1'] || 
                          position[1]
      const instrumentSymbol = instrumentId ? instrumentSymbolMap.get(String(instrumentId)) : 'Unknown'

      // Format dates
      const entryTime = normalized.openTime ? new Date(normalized.openTime) : null
      const exitTime = normalized.closeTime ? new Date(normalized.closeTime) : null
      
      const entryTimeStr = entryTime ? entryTime.toLocaleString('en-US', { 
        timeZone: 'Europe/Sofia', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      }) : 'N/A'
      
      const exitTimeStr = exitTime ? exitTime.toLocaleString('en-US', { 
        timeZone: 'Europe/Sofia', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      }) : 'N/A'

      // Calculate P&L if not provided
      let pnl = parseFloat(normalized.profit) || 0
      if (Math.abs(pnl) < 0.0001 && normalized.openPrice > 0 && normalized.closePrice > 0 && normalized.volume > 0) {
        const type = (normalized.type || '').toLowerCase()
        if (type === 'buy') {
          pnl = (normalized.closePrice - normalized.openPrice) * normalized.volume
        } else if (type === 'sell') {
          pnl = (normalized.openPrice - normalized.closePrice) * normalized.volume
        }
      }

      // Calculate Net P&L
      const commission = parseFloat(normalized.commission) || 0
      const swap = parseFloat(normalized.swap) || 0
      const netPnL = pnl - Math.abs(commission) - swap

      console.log(`Trade #${i + 1}:`)
      console.log('─'.repeat(120))
      console.log(`  Instrument:        ${instrumentSymbol || instrumentId || 'N/A'}`)
      console.log(`  Entry Time (EET):  ${entryTimeStr}`)
      console.log(`  Type:              ${(normalized.orderType || 'N/A').toUpperCase()}`)
      console.log(`  Side:              ${(normalized.type || 'N/A').toUpperCase()}`)
      console.log(`  Amount:            ${normalized.volume || 0}`)
      console.log(`  Entry Price:       ${normalized.openPrice ? normalized.openPrice.toFixed(2) : 'N/A'}`)
      console.log(`  SL Price:          ${normalized.stopPrice > 0 ? normalized.stopPrice.toFixed(2) : 'N/A'}`)
      console.log(`  TP Price:          ${normalized.takeProfit > 0 ? normalized.takeProfit.toFixed(2) : 'N/A'}`)
      console.log(`  Exit Time (EET):   ${exitTimeStr}`)
      console.log(`  Exit Price:        ${normalized.closePrice ? normalized.closePrice.toFixed(2) : 'N/A'}`)
      console.log(`  Fee:               $${commission.toFixed(2)}`)
      console.log(`  Swap:              $${swap.toFixed(2)}`)
      console.log(`  P&L:               $${pnl.toFixed(2)}`)
      console.log(`  Net P&L:           $${netPnL.toFixed(2)}`)
      console.log(`  Order ID:          ${normalized.ticket || 'N/A'}`)
      console.log(`  Position ID:       ${normalized.positionId || 'N/A'}`)
      console.log()
    }

    console.log('='.repeat(120))
    console.log('✅ Done!')
    console.log('='.repeat(120))

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

getLatestTrades()
