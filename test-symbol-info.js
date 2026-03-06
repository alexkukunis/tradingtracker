/**
 * Test symbolInfo endpoint and other symbol-related endpoints
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testSymbolInfo() {
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
    
    const baseUrl = ENVIRONMENT === 'live' 
      ? 'https://live.tradelocker.com/backend-api'
      : 'https://demo.tradelocker.com/backend-api'

    const commonHeaders = {
      'Authorization': `Bearer ${authResult.accessToken}`,
      'accNum': String(accNum),
      'Content-Type': 'application/json'
    }

    // Get instrument ID from first trade
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    const instrumentId = closedPositions[0]?.['1'] || closedPositions[0]?.[1]
    console.log(`Testing with instrument ID: ${instrumentId}\n`)

    // Test various symbolInfo endpoints
    const endpoints = [
      `${baseUrl}/trade/symbolInfo`,
      `${baseUrl}/trade/symbolInfo/${instrumentId}`,
      `${baseUrl}/trade/accounts/${ACCOUNT_ID}/symbolInfo`,
      `${baseUrl}/trade/accounts/${ACCOUNT_ID}/symbolInfo/${instrumentId}`,
      `${baseUrl}/trade/market/symbolInfo`,
      `${baseUrl}/trade/market/symbolInfo/${instrumentId}`,
      `${baseUrl}/trade/instruments/${instrumentId}/symbolInfo`,
    ]

    for (const url of endpoints) {
      try {
        console.log(`Trying: ${url}`)
        const response = await fetch(url, {
          method: 'GET',
          headers: commonHeaders
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Success!`)
          console.log('Response keys:', Object.keys(data))
          console.log('Response:', JSON.stringify(data, null, 2).substring(0, 2000))
          break
        } else {
          console.log(`  Status: ${response.status}`)
          if (response.status !== 404) {
            const errorText = await response.text()
            console.log(`  Error: ${errorText.substring(0, 200)}`)
          }
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`)
      }
    }

    // Also check open positions - they might have instrument names
    console.log('\n\n🔍 Checking open positions for instrument info\n')
    try {
      const openPositions = await tradelockerService.getOpenPositions(
        authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
      )
      
      if (openPositions && openPositions.length > 0) {
        console.log(`Found ${openPositions.length} open positions`)
        console.log('First open position structure:')
        console.log(JSON.stringify(openPositions[0], null, 2))
      } else {
        console.log('No open positions')
      }
    } catch (error) {
      console.log(`Error fetching open positions: ${error.message}`)
    }

    // Check if ordersHistory response has metadata
    console.log('\n\n🔍 Checking ordersHistory response structure for metadata\n')
    try {
      const response = await fetch(`${baseUrl}/trade/accounts/${ACCOUNT_ID}/ordersHistory`, {
        method: 'GET',
        headers: commonHeaders
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Full response keys:', Object.keys(data))
        console.log('Response structure:', JSON.stringify(data, null, 2).substring(0, 1500))
      }
    } catch (error) {
      console.log(`Error: ${error.message}`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ All tests complete!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testSymbolInfo()
