/**
 * Check the last trade from TradeLocker
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function checkLastTrade() {
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

    console.log(`Found ${closedPositions.length} total trades\n`)

    // Sort by close time (index 14) - most recent first
    const sortedTrades = [...closedPositions].sort((a, b) => {
      const timeA = parseInt(a['14'] || a[14] || 0)
      const timeB = parseInt(b['14'] || b[14] || 0)
      return timeB - timeA // Descending (newest first)
    })

    // Get today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    // Filter today's trades
    const todayTrades = sortedTrades.filter(trade => {
      const closeTime = parseInt(trade['14'] || trade[14] || 0)
      if (!closeTime) return false
      const closeDate = new Date(closeTime)
      return closeDate >= today && closeDate <= todayEnd
    })

    console.log(`📅 Today's trades: ${todayTrades.length}\n`)

    if (todayTrades.length > 0) {
      const lastTrade = todayTrades[0] // Most recent
      const closeTime = parseInt(lastTrade['14'] || lastTrade[14] || 0)
      const closeDate = new Date(closeTime)
      const profit = parseFloat(lastTrade['10'] || lastTrade[10] || 0)
      const type = lastTrade['4'] || lastTrade[4] || ''
      const volume = lastTrade['3'] || lastTrade[3] || ''
      const openPrice = parseFloat(lastTrade['8'] || lastTrade[8] || 0)
      const closePrice = parseFloat(lastTrade['9'] || lastTrade[9] || 0)
      const ticket = lastTrade['0'] || lastTrade[0] || ''

      console.log('🎯 YOUR LAST TRADE TODAY:\n')
      console.log('=' .repeat(60))
      console.log(`Time: ${closeDate.toLocaleString()}`)
      console.log(`Ticket ID: ${ticket}`)
      console.log(`Type: ${type.toUpperCase()}`)
      console.log(`Volume: ${volume}`)
      console.log(`Open Price: ${openPrice}`)
      console.log(`Close Price: ${closePrice}`)
      console.log(`Profit/Loss: $${profit.toFixed(2)}`)
      console.log(`Result: ${profit > 0 ? 'WIN ✅' : profit < 0 ? 'LOSS ❌' : 'BREAKEVEN ➖'}`)
      console.log('=' .repeat(60))

      // Show last 5 trades today
      if (todayTrades.length > 1) {
        console.log(`\n📊 Last 5 trades today:\n`)
        todayTrades.slice(0, 5).forEach((trade, idx) => {
          const ct = new Date(parseInt(trade['14'] || trade[14] || 0))
          const p = parseFloat(trade['10'] || trade[10] || 0)
          const t = trade['4'] || trade[4] || ''
          const v = trade['3'] || trade[3] || ''
          console.log(`${idx + 1}. ${ct.toLocaleTimeString()} - ${t.toUpperCase()} ${v} - PnL: $${p.toFixed(2)}`)
        })
      }
    } else {
      console.log('⚠️  No trades found for today')
      console.log('\n📊 Most recent trades (last 5):\n')
      sortedTrades.slice(0, 5).forEach((trade, idx) => {
        const closeTime = parseInt(trade['14'] || trade[14] || 0)
        const closeDate = new Date(closeTime)
        const profit = parseFloat(trade['10'] || trade[10] || 0)
        const type = trade['4'] || trade[4] || ''
        const volume = trade['3'] || trade[3] || ''
        console.log(`${idx + 1}. ${closeDate.toLocaleString()} - ${type.toUpperCase()} ${volume} - PnL: $${profit.toFixed(2)}`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

checkLastTrade()
