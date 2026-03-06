/**
 * Test script to find:
 * 1. Where the actual realized P&L is stored (if anywhere)
 * 2. Where the instrument/pair information is stored
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function findPnLAndInstrument() {
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

    // Get trade config to see field mappings
    console.log('📋 Fetching trade config...\n')
    const config = await tradelockerService.getTradeConfig(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    if (config && config.d && config.d.ordersHistoryConfig) {
      console.log('Orders History Config columns:')
      config.d.ordersHistoryConfig.columns.forEach((col, idx) => {
        console.log(`  [${idx}] ${col.id}`)
      })
      console.log()
    }

    // Examine first few filled trades in detail
    const filledTrades = closedPositions
      .filter(trade => {
        const status = trade['6'] || trade[6] || ''
        return status && status.toLowerCase() === 'filled'
      })
      .slice(0, 5)

    console.log(`\n🔍 Examining ${filledTrades.length} filled trades in detail:\n`)
    console.log('=' .repeat(100))

    filledTrades.forEach((trade, idx) => {
      console.log(`\n📈 Trade #${idx + 1}:`)
      
      // Show all indices and their values
      console.log('\nAll field values:')
      for (let i = 0; i < 25; i++) {
        const val = trade[i] !== undefined ? trade[i] : trade[String(i)]
        if (val !== null && val !== undefined && val !== '') {
          // Try to identify what this field might be based on config
          let fieldName = `[${i}]`
          if (config && config.d && config.d.ordersHistoryConfig) {
            const col = config.d.ordersHistoryConfig.columns[i]
            if (col) fieldName = `[${i}] ${col.id}`
          }
          console.log(`  ${fieldName}: ${JSON.stringify(val)}`)
        }
      }

      // Calculate expected P&L
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

      console.log(`\n  Summary:`)
      console.log(`    Type: ${type}, Volume: ${volume}`)
      console.log(`    Open Price [8]: ${openPrice}, Close Price [9]: ${closePrice}`)
      console.log(`    Profit [10]: ${parseFloat(trade['10'] || trade[10] || 0)}`)
      console.log(`    Calculated P&L: ${calculatedPnL.toFixed(4)}`)
      
      // Check if any field matches calculated P&L
      for (let i = 0; i < 25; i++) {
        const val = parseFloat(trade[i] || trade[String(i)] || 0)
        if (!isNaN(val) && Math.abs(val) > 0.0001 && Math.abs(val - calculatedPnL) < 0.01) {
          console.log(`    ✅ Field [${i}] matches calculated P&L: ${val}`)
        }
      }

      console.log(`\n${'─'.repeat(100)}`)
    })

    // Also check if we can get instrument info from a different endpoint
    console.log('\n\n🔍 Checking if we can get instrument details...\n')
    
    // Try to get instrument info - we might need tradableInstrumentId from index [1] or [2]
    if (filledTrades.length > 0) {
      const firstTrade = filledTrades[0]
      const tradableInstrumentId = firstTrade['1'] || firstTrade[1] || firstTrade['2'] || firstTrade[2]
      
      if (tradableInstrumentId) {
        console.log(`Trying to get instrument info for tradableInstrumentId: ${tradableInstrumentId}`)
        
        const baseUrl = 'https://live.tradelocker.com/backend-api'
        try {
          // Try instrument details endpoint
          const instResponse = await fetch(`${baseUrl}/trade/instruments/${tradableInstrumentId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authResult.accessToken}`,
              'accNum': String(accNum),
              'Content-Type': 'application/json'
            }
          })
          
          if (instResponse.ok) {
            const instData = await instResponse.json()
            console.log('Instrument details:', JSON.stringify(instData, null, 2).substring(0, 500))
          } else {
            console.log(`Instrument endpoint returned: ${instResponse.status}`)
          }
        } catch (err) {
          console.log(`Error fetching instrument: ${err.message}`)
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

findPnLAndInstrument()
