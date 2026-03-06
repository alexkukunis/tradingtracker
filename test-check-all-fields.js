/**
 * Test script to check all fields in TradeLocker ordersHistory response
 * to find where the actual realized P&L is stored
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function checkAllFields() {
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

    // Find trades with non-zero values in any numeric field
    console.log('🔍 Analyzing first 10 trades to find P&L field...\n')
    console.log('=' .repeat(100))

    for (let i = 0; i < Math.min(10, closedPositions.length); i++) {
      const trade = closedPositions[i]
      
      // Show all fields with their values
      console.log(`\n📈 Trade #${i + 1}:`)
      
      // Check all numeric indices
      const numericFields = []
      for (let idx = 0; idx < 25; idx++) {
        const key = String(idx)
        const value = trade[key] || trade[idx]
        if (value !== null && value !== undefined && value !== '') {
          const numValue = parseFloat(value)
          if (!isNaN(numValue) && Math.abs(numValue) > 0.0001) {
            numericFields.push({ idx, value: numValue })
          }
        }
      }
      
      // Show key fields
      const type = trade['4'] || trade[4] || ''
      const volume = parseFloat(trade['3'] || trade[3] || 0)
      const openPrice = parseFloat(trade['8'] || trade[8] || 0)
      const closePrice = parseFloat(trade['9'] || trade[9] || 0)
      const status = trade['6'] || trade[6] || ''
      const profitIndex10 = parseFloat(trade['10'] || trade[10] || 0)
      
      console.log(`  Type: ${type}, Volume: ${volume}, Status: ${status}`)
      console.log(`  Open: ${openPrice}, Close: ${closePrice}`)
      console.log(`  Index [10] (profit): ${profitIndex10}`)
      
      // Calculate expected P&L
      let calculatedPnL = 0
      if (type.toLowerCase() === 'buy' && openPrice && closePrice) {
        calculatedPnL = (closePrice - openPrice) * volume
      } else if (type.toLowerCase() === 'sell' && openPrice && closePrice) {
        calculatedPnL = (openPrice - closePrice) * volume
      }
      
      console.log(`  Calculated P&L (from prices): ${calculatedPnL.toFixed(4)}`)
      
      // Show all non-zero numeric fields
      if (numericFields.length > 0) {
        console.log(`  Non-zero numeric fields:`)
        numericFields.forEach(({ idx, value }) => {
          console.log(`    [${idx}]: ${value}`)
        })
      }
      
      // Check if any field matches the calculated P&L
      const matchingField = numericFields.find(({ value }) => 
        Math.abs(value - calculatedPnL) < 0.01
      )
      if (matchingField) {
        console.log(`  ✅ Field [${matchingField.idx}] matches calculated P&L!`)
      }
      
      console.log(`\n${'─'.repeat(100)}`)
    }

    // Try to find a pattern - look for trades where calculated P&L is significant
    console.log('\n\n🔍 Searching for trades with significant P&L...\n')
    let foundSignificant = 0
    
    for (let i = 0; i < Math.min(closedPositions.length, 100); i++) {
      const trade = closedPositions[i]
      const type = trade['4'] || trade[4] || ''
      const volume = parseFloat(trade['3'] || trade[3] || 0)
      const openPrice = parseFloat(trade['8'] || trade[8] || 0)
      const closePrice = parseFloat(trade['9'] || trade[9] || 0)
      
      let calculatedPnL = 0
      if (type.toLowerCase() === 'buy' && openPrice && closePrice) {
        calculatedPnL = (closePrice - openPrice) * volume
      } else if (type.toLowerCase() === 'sell' && openPrice && closePrice) {
        calculatedPnL = (openPrice - closePrice) * volume
      }
      
      if (Math.abs(calculatedPnL) > 1.0) {
        foundSignificant++
        console.log(`Trade #${i + 1}: Calculated P&L = ${calculatedPnL.toFixed(4)}`)
        
        // Check all fields for this trade
        for (let idx = 0; idx < 25; idx++) {
          const value = parseFloat(trade[idx] || trade[String(idx)] || 0)
          if (Math.abs(value) > 0.01 && Math.abs(value - calculatedPnL) < 0.1) {
            console.log(`  ✅ Field [${idx}] = ${value} (close to calculated P&L)`)
          }
        }
        
        if (foundSignificant >= 5) break
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

checkAllFields()
