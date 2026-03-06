/**
 * Test script to examine the actual structure of ordersHistory response
 * and see if we can find realized P&L in a different format or endpoint
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testOrdersHistoryStructure() {
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

    console.log('📊 Fetching ordersHistory...\n')
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    console.log(`Found ${closedPositions.length} trades\n`)

    // Get the raw response to see the full structure
    const baseUrl = 'https://live.tradelocker.com/backend-api'
    const response = await fetch(`${baseUrl}/trade/accounts/${ACCOUNT_ID}/ordersHistory`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authResult.accessToken}`,
        'accNum': String(accNum),
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const rawData = await response.json()
      console.log('📋 Raw API Response Structure:\n')
      console.log('Top level keys:', Object.keys(rawData))
      
      if (rawData.d && rawData.d.ordersHistory) {
        const orders = rawData.d.ordersHistory
        console.log(`\nFound ${orders.length} orders in response\n`)
        
        // Look at first few FILLED orders to see structure
        const filledOrders = orders.filter((order, idx) => {
          const status = order['6'] || order[6] || ''
          return status && status.toLowerCase() === 'filled'
        }).slice(0, 3)
        
        console.log(`\n🔍 Examining ${filledOrders.length} FILLED orders:\n`)
        
        filledOrders.forEach((order, idx) => {
          console.log(`\n--- Filled Order #${idx + 1} ---`)
          const keys = Object.keys(order)
          console.log(`Format: ${keys.every(k => !isNaN(parseInt(k))) ? 'Array format' : 'Object format'}`)
          console.log(`Keys/Indices: ${keys.slice(0, 25).join(', ')}`)
          
          // Show all non-null values
          console.log('\nAll field values:')
          for (let i = 0; i < 25; i++) {
            const val = order[i] !== undefined ? order[i] : order[String(i)]
            if (val !== null && val !== undefined && val !== '') {
              const type = order['4'] || order[4] || ''
              const volume = parseFloat(order['3'] || order[3] || 0)
              const openPrice = parseFloat(order['8'] || order[8] || 0)
              const closePrice = parseFloat(order['9'] || order[9] || 0)
              let expectedPnL = 0
              if (type.toLowerCase() === 'buy' && openPrice && closePrice) {
                expectedPnL = (closePrice - openPrice) * volume
              } else if (type.toLowerCase() === 'sell' && openPrice && closePrice) {
                expectedPnL = (openPrice - closePrice) * volume
              }
              
              const numVal = parseFloat(val)
              const matchesPnL = !isNaN(numVal) && Math.abs(numVal - expectedPnL) < 0.01 && Math.abs(expectedPnL) > 0.0001
              const marker = matchesPnL ? ' ✅ P&L!' : ''
              console.log(`  [${i}]: ${JSON.stringify(val)} (${typeof val})${marker}`)
            }
          }
          
          // Show calculated vs index [10]
          const type = order['4'] || order[4] || ''
          const volume = parseFloat(order['3'] || order[3] || 0)
          const openPrice = parseFloat(order['8'] || order[8] || 0)
          const closePrice = parseFloat(order['9'] || order[9] || 0)
          const profitIndex10 = parseFloat(order['10'] || order[10] || 0)
          
          let calculatedPnL = 0
          if (type.toLowerCase() === 'buy' && openPrice && closePrice) {
            calculatedPnL = (closePrice - openPrice) * volume
          } else if (type.toLowerCase() === 'sell' && openPrice && closePrice) {
            calculatedPnL = (openPrice - closePrice) * volume
          }
          
          console.log(`\n  Summary:`)
          console.log(`    Type: ${type}, Volume: ${volume}`)
          console.log(`    Open: ${openPrice}, Close: ${closePrice}`)
          console.log(`    Index [10] (profit): ${profitIndex10}`)
          console.log(`    Calculated P&L: ${calculatedPnL.toFixed(4)}`)
        })
      }
    }

    // Also check if there's a positionsHistory endpoint that might have P&L
    console.log('\n\n🔍 Checking positionsHistory endpoint...\n')
    const positionsResponse = await fetch(`${baseUrl}/trade/accounts/${ACCOUNT_ID}/positionsHistory`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authResult.accessToken}`,
        'accNum': String(accNum),
        'Content-Type': 'application/json'
      }
    })

    if (positionsResponse.ok) {
      const positionsData = await positionsResponse.json()
      console.log('✅ positionsHistory response:')
      console.log('Top level keys:', Object.keys(positionsData))
      if (positionsData.d) {
        console.log('d keys:', Object.keys(positionsData.d))
        if (positionsData.d.positionsHistory && positionsData.d.positionsHistory.length > 0) {
          const firstPos = positionsData.d.positionsHistory[0]
          console.log('\nFirst position keys:', Object.keys(firstPos))
          console.log('First position sample:', JSON.stringify(firstPos, null, 2).substring(0, 1000))
        }
      }
    } else {
      console.log(`positionsHistory returned: ${positionsResponse.status}`)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testOrdersHistoryStructure()
