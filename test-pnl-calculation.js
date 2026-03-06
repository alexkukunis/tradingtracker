/**
 * Test PnL calculation with the updated transformation
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testPnLCalculation() {
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
    
    // Show structure of first trade for debugging
    if (closedPositions.length > 0) {
      console.log('📋 First trade structure (for debugging):')
      const firstTrade = closedPositions[0]
      const keys = Object.keys(firstTrade)
      console.log(`  Format: ${keys.every(k => !isNaN(parseInt(k))) ? 'Array format (numeric indices)' : 'Object format (named fields)'}`)
      console.log(`  Keys: ${keys.slice(0, 20).join(', ')}${keys.length > 20 ? '...' : ''}`)
      // Check for P&L fields
      const pnlFields = ['realizedPnL', 'realizedProfit', 'profit', 'pnl', '10']
      const foundPnl = pnlFields.find(f => firstTrade[f] !== undefined && firstTrade[f] !== null)
      if (foundPnl) {
        console.log(`  ✅ Found P&L field: ${foundPnl} = ${firstTrade[foundPnl]}`)
      } else {
        console.log(`  ⚠️  No P&L field found in: ${pnlFields.join(', ')}`)
      }
      console.log()
    }

    // Sort by close time - most recent first
    // Handle both array format (numeric indices) and object format (named fields)
    const sortedTrades = [...closedPositions].sort((a, b) => {
      const timeA = parseInt(
        a.closeTime || a.closeTimestamp || a.closeDate || 
        a['14'] || a[14] || 0
      )
      const timeB = parseInt(
        b.closeTime || b.closeTimestamp || b.closeDate || 
        b['14'] || b[14] || 0
      )
      return timeB - timeA
    })

    const startingBalance = parseFloat(account?.accountBalance || 699.84)
    const settings = { riskPercent: 2, riskReward: 3, startingBalance }

    console.log('🔄 Testing PnL calculation with updated transformation...\n')
    console.log('=' .repeat(80))

    let currentBalance = startingBalance
    let hasNonZeroPnL = false

    for (let i = 0; i < Math.min(20, sortedTrades.length); i++) {
      const rawTrade = sortedTrades[i]
      const transformed = tradelockerService.transformTradeLockerTrade(
        rawTrade,
        currentBalance,
        settings
      )
      currentBalance = transformed.closeBalance

      // Handle both array and object formats
      const closeTime = parseInt(
        rawTrade.closeTime || rawTrade.closeTimestamp || rawTrade.closeDate ||
        rawTrade['14'] || rawTrade[14] || 0
      )
      const closeDate = new Date(closeTime)
      const type = rawTrade.type || rawTrade.side || rawTrade.direction || rawTrade['4'] || rawTrade[4] || ''
      const volume = rawTrade.volume || rawTrade.lotSize || rawTrade.size || rawTrade['3'] || rawTrade[3] || ''
      const openPrice = parseFloat(rawTrade.openPrice || rawTrade.open || rawTrade.entryPrice || rawTrade['8'] || rawTrade[8] || 0)
      const closePrice = parseFloat(rawTrade.closePrice || rawTrade.close || rawTrade.exitPrice || rawTrade['9'] || rawTrade[9] || 0)
      const status = rawTrade.status || rawTrade.state || rawTrade['6'] || rawTrade[6] || ''
      const profitIndex10 = parseFloat(
        rawTrade.realizedPnL || rawTrade.realizedProfit || rawTrade.profit || rawTrade.pnl ||
        rawTrade['10'] || rawTrade[10] || 0
      )

      // Calculate expected PnL
      let expectedPnL = 0
      if (status === 'Filled' && openPrice > 0 && closePrice > 0) {
        if (type.toLowerCase() === 'buy') {
          expectedPnL = (closePrice - openPrice) * parseFloat(volume)
        } else if (type.toLowerCase() === 'sell') {
          expectedPnL = (openPrice - closePrice) * parseFloat(volume)
        }
      }

      if (Math.abs(transformed.pnl) > 0.0001 || Math.abs(expectedPnL) > 0.0001) {
        hasNonZeroPnL = true
        console.log(`\n📈 Trade #${i + 1}:`)
        console.log(`   Time: ${closeDate.toLocaleString()}`)
        console.log(`   Type: ${type.toUpperCase()} | Volume: ${volume} | Status: ${status}`)
        console.log(`   Open: ${openPrice} | Close: ${closePrice}`)
        console.log(`   Index [10] profit: ${profitIndex10}`)
        console.log(`   Expected PnL (calculated): ${expectedPnL.toFixed(4)}`)
        console.log(`   ✨ Transformed PnL: ${transformed.pnl.toFixed(4)}`)
        console.log(`   Result: ${transformed.result}`)
        
        if (Math.abs(transformed.pnl - expectedPnL) > 0.01) {
          console.log(`   ⚠️  WARNING: Mismatch! Expected ${expectedPnL.toFixed(4)}, got ${transformed.pnl.toFixed(4)}`)
        } else {
          console.log(`   ✅ PnL calculation correct!`)
        }
        console.log(`\n${'─'.repeat(80)}`)
      }
    }

    if (!hasNonZeroPnL) {
      console.log('⚠️  First 20 trades all have zero PnL')
      console.log('Showing first 5 trades anyway:\n')
      
      for (let i = 0; i < Math.min(5, sortedTrades.length); i++) {
        const rawTrade = sortedTrades[i]
        const transformed = tradelockerService.transformTradeLockerTrade(
          rawTrade,
          startingBalance,
          settings
        )
        
        const closeTime = parseInt(
          rawTrade.closeTime || rawTrade.closeTimestamp || rawTrade.closeDate ||
          rawTrade['14'] || rawTrade[14] || 0
        )
        const closeDate = new Date(closeTime)
        const type = rawTrade.type || rawTrade.side || rawTrade.direction || rawTrade['4'] || rawTrade[4] || ''
        const volume = rawTrade.volume || rawTrade.lotSize || rawTrade.size || rawTrade['3'] || rawTrade[3] || ''
        const openPrice = parseFloat(rawTrade.openPrice || rawTrade.open || rawTrade.entryPrice || rawTrade['8'] || rawTrade[8] || 0)
        const closePrice = parseFloat(rawTrade.closePrice || rawTrade.close || rawTrade.exitPrice || rawTrade['9'] || rawTrade[9] || 0)
        const status = rawTrade.status || rawTrade.state || rawTrade['6'] || rawTrade[6] || ''
        
        console.log(`Trade #${i + 1}: ${closeDate.toLocaleString()} - ${type.toUpperCase()} ${volume}`)
        console.log(`  Open: ${openPrice} | Close: ${closePrice} | Status: ${status}`)
        console.log(`  Transformed PnL: ${transformed.pnl.toFixed(4)}`)
        console.log()
      }
    }

    // Get today's last trade
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const todayTrades = sortedTrades.filter(trade => {
      const closeTime = parseInt(
        trade.closeTime || trade.closeTimestamp || trade.closeDate ||
        trade['14'] || trade[14] || 0
      )
      if (!closeTime) return false
      const closeDate = new Date(closeTime)
      return closeDate >= today && closeDate <= todayEnd
    })

    if (todayTrades.length > 0) {
      const lastTrade = todayTrades[0]
      const transformed = tradelockerService.transformTradeLockerTrade(
        lastTrade,
        startingBalance,
        settings
      )
      
      const closeTime = parseInt(
        lastTrade.closeTime || lastTrade.closeTimestamp || lastTrade.closeDate ||
        lastTrade['14'] || lastTrade[14] || 0
      )
      const closeDate = new Date(closeTime)
      const type = lastTrade.type || lastTrade.side || lastTrade.direction || lastTrade['4'] || lastTrade[4] || ''
      const volume = lastTrade.volume || lastTrade.lotSize || lastTrade.size || lastTrade['3'] || lastTrade[3] || ''
      const openPrice = parseFloat(lastTrade.openPrice || lastTrade.open || lastTrade.entryPrice || lastTrade['8'] || lastTrade[8] || 0)
      const closePrice = parseFloat(lastTrade.closePrice || lastTrade.close || lastTrade.exitPrice || lastTrade['9'] || lastTrade[9] || 0)
      
      console.log('\n\n🎯 YOUR LAST TRADE TODAY (with corrected PnL):\n')
      console.log('=' .repeat(60))
      console.log(`Time: ${closeDate.toLocaleString()}`)
      console.log(`Type: ${type.toUpperCase()}`)
      console.log(`Volume: ${volume}`)
      console.log(`Open Price: ${openPrice}`)
      console.log(`Close Price: ${closePrice}`)
      console.log(`Profit/Loss: $${transformed.pnl.toFixed(4)}`)
      console.log(`Result: ${transformed.result}`)
      console.log('=' .repeat(60))
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testPnLCalculation()
