/**
 * Debug script to find where actual PnL is stored in TradeLocker trades
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function debugTradeStructure() {
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

    console.log(`Found ${closedPositions.length} trades\n`)

    // Show detailed structure of first 10 trades
    console.log('🔍 Analyzing trade structure...\n')
    console.log('=' .repeat(80))

    for (let i = 0; i < Math.min(10, closedPositions.length); i++) {
      const trade = closedPositions[i]
      
      console.log(`\n📈 Trade #${i + 1}:`)
      console.log('Full array structure:')
      
      // Show all indices with their values
      for (let idx = 0; idx < 22; idx++) {
        const key = String(idx)
        const value = trade[key] || trade[idx]
        if (value !== null && value !== undefined && value !== '') {
          console.log(`  [${idx}]: ${JSON.stringify(value)} (${typeof value})`)
        }
      }

      // Calculate PnL from prices
      const type = trade['4'] || trade[4] || ''
      const volume = parseFloat(trade['3'] || trade[3] || 0)
      const openPrice = parseFloat(trade['8'] || trade[8] || 0)
      const closePrice = parseFloat(trade['9'] || trade[9] || 0)
      const profitIndex10 = parseFloat(trade['10'] || trade[10] || 0)
      
      // Calculate expected PnL
      let calculatedPnL = 0
      if (type.toLowerCase() === 'buy' && openPrice && closePrice) {
        calculatedPnL = (closePrice - openPrice) * volume
      } else if (type.toLowerCase() === 'sell' && openPrice && closePrice) {
        calculatedPnL = (openPrice - closePrice) * volume
      }

      console.log(`\n  Analysis:`)
      console.log(`    Type: ${type}`)
      console.log(`    Volume: ${volume}`)
      console.log(`    Open Price: ${openPrice}`)
      console.log(`    Close Price: ${closePrice}`)
      console.log(`    Index [10] (profit field): ${profitIndex10}`)
      console.log(`    Calculated PnL (from prices): ${calculatedPnL.toFixed(4)}`)
      
      if (Math.abs(calculatedPnL) > 0.0001) {
        console.log(`    ⚠️  MISMATCH! Index [10] shows ${profitIndex10} but calculated PnL is ${calculatedPnL.toFixed(4)}`)
      }

      console.log(`\n${'─'.repeat(80)}`)
    }

    // Search for trades with non-zero values in any numeric field
    console.log('\n\n🔍 Searching for trades with non-zero profit values...\n')
    
    let foundNonZero = 0
    for (let i = 0; i < Math.min(closedPositions.length, 500); i++) {
      const trade = closedPositions[i]
      const profitIndex10 = parseFloat(trade['10'] || trade[10] || 0)
      
      // Also check other numeric indices
      const checkIndices = [10, 17] // 17 might be another price/profit field
      
      for (const idx of checkIndices) {
        const value = parseFloat(trade[String(idx)] || trade[idx] || 0)
        if (Math.abs(value) > 0.01) {
          foundNonZero++
          console.log(`Trade #${i + 1} has non-zero value at index [${idx}]: ${value}`)
          if (foundNonZero >= 5) break
        }
      }
      if (foundNonZero >= 5) break
    }

    if (foundNonZero === 0) {
      console.log('⚠️  No trades found with non-zero profit at index [10]')
      console.log('💡 We may need to calculate PnL from price difference and volume\n')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

debugTradeStructure()
