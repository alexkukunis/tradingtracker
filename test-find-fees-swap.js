/**
 * Test to find where Fee and Swap are stored in the API response
 * Based on example: Fee: -$0.19, Swap: $0.00, P&L: $1.27, Net P&L: $1.08
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'
const ORDER_ID = '7277816997883345529' // From the example

async function findFeesAndSwap() {
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

    // Find the specific trade from the example
    const exampleTrade = closedPositions.find(trade => 
      (trade['0'] || trade[0]) === ORDER_ID || 
      String(trade['0'] || trade[0]) === ORDER_ID
    )

    if (!exampleTrade) {
      console.log(`❌ Could not find trade with Order ID: ${ORDER_ID}`)
      console.log('Showing first trade instead:\n')
      const firstTrade = closedPositions[0]
      console.log('First trade Order ID:', firstTrade['0'] || firstTrade[0])
      console.log('All fields:')
      for (let i = 0; i < 25; i++) {
        const val = firstTrade[i] !== undefined ? firstTrade[i] : firstTrade[String(i)]
        if (val !== null && val !== undefined && val !== '') {
          console.log(`  [${i}]: ${JSON.stringify(val)}`)
        }
      }
      return
    }

    console.log(`✅ Found example trade (Order ID: ${ORDER_ID})\n`)
    console.log('=' .repeat(100))
    console.log('\nExpected values from example:')
    console.log('  Instrument: NAS100')
    console.log('  Entry Price: 24,876.12')
    console.log('  Exit Price: 24,869.41')
    console.log('  Side: Sell')
    console.log('  Amount: 0.19')
    console.log('  Fee: -$0.19')
    console.log('  Swap: $0.00')
    console.log('  P&L: $1.27')
    console.log('  Net P&L: $1.08')
    console.log('  Position ID: 7277816997840521702')
    
    console.log('\n' + '=' .repeat(100))
    console.log('\nActual API response:\n')
    
    // Show all fields
    for (let i = 0; i < 25; i++) {
      const val = exampleTrade[i] !== undefined ? exampleTrade[i] : exampleTrade[String(i)]
      if (val !== null && val !== undefined && val !== '') {
        // Try to identify what this might be
        let fieldName = `[${i}]`
        const numVal = parseFloat(val)
        const isNumeric = !isNaN(numVal)
        
        // Check if this could be fee, swap, or P&L
        let possibleMatch = ''
        if (isNumeric) {
          if (Math.abs(numVal - 1.27) < 0.01) possibleMatch = ' ← Could be P&L ($1.27)'
          else if (Math.abs(numVal - 1.08) < 0.01) possibleMatch = ' ← Could be Net P&L ($1.08)'
          else if (Math.abs(numVal - (-0.19)) < 0.01) possibleMatch = ' ← Could be Fee (-$0.19)'
          else if (Math.abs(numVal - 0.00) < 0.0001) possibleMatch = ' ← Could be Swap ($0.00)'
          else if (Math.abs(numVal - 24876.12) < 0.01) possibleMatch = ' ← Could be Entry Price'
          else if (Math.abs(numVal - 24869.41) < 0.01) possibleMatch = ' ← Could be Exit Price'
        }
        
        console.log(`  ${fieldName}: ${JSON.stringify(val)}${possibleMatch}`)
      }
    }

    // Calculate expected P&L
    const side = exampleTrade['4'] || exampleTrade[4] || ''
    const amount = parseFloat(exampleTrade['3'] || exampleTrade[3] || 0)
    const entryPrice = parseFloat(exampleTrade['8'] || exampleTrade[8] || 0)
    const exitPrice = parseFloat(exampleTrade['9'] || exampleTrade[9] || 0)
    
    let calculatedPnL = 0
    if (side.toLowerCase() === 'sell' && entryPrice && exitPrice) {
      calculatedPnL = (entryPrice - exitPrice) * amount
    } else if (side.toLowerCase() === 'buy' && entryPrice && exitPrice) {
      calculatedPnL = (exitPrice - entryPrice) * amount
    }
    
    console.log('\n' + '=' .repeat(100))
    console.log('\nCalculated P&L from prices:')
    console.log(`  Side: ${side}, Amount: ${amount}`)
    console.log(`  Entry: ${entryPrice}, Exit: ${exitPrice}`)
    console.log(`  Calculated P&L: $${calculatedPnL.toFixed(2)}`)
    console.log(`  Expected P&L: $1.27`)
    console.log(`  Difference: $${(calculatedPnL - 1.27).toFixed(2)}`)
    
    if (Math.abs(calculatedPnL - 1.27) < 0.01) {
      console.log('  ✅ Calculated P&L matches expected!')
    } else {
      console.log('  ⚠️  Calculated P&L does NOT match expected')
      console.log('  This suggests the API might provide the actual P&L somewhere, or there are fees/swap included')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

findFeesAndSwap()
