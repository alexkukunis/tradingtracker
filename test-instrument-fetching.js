/**
 * Test script to investigate instrument name fetching from TradeLocker API
 * This will help us understand the correct API endpoints and response structure
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testInstrumentFetching() {
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

    // Get first trade to test with
    console.log('📈 Fetching first closed position...\n')
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    if (closedPositions.length === 0) {
      console.log('❌ No trades found')
      return
    }

    const firstTrade = closedPositions[0]
    console.log('📋 First Trade Raw Data:')
    console.log('─'.repeat(80))
    console.log('All keys:', Object.keys(firstTrade))
    console.log('\nKey fields:')
    console.log(`  [0] Order ID:        ${firstTrade['0'] || firstTrade[0] || 'N/A'}`)
    console.log(`  [1] Instrument ID?: ${firstTrade['1'] || firstTrade[1] || 'N/A'}`)
    console.log(`  [2] Position ID:    ${firstTrade['2'] || firstTrade[2] || 'N/A'}`)
    console.log(`  [3] Volume:         ${firstTrade['3'] || firstTrade[3] || 'N/A'}`)
    console.log(`  [4] Type:           ${firstTrade['4'] || firstTrade[4] || 'N/A'}`)
    console.log()

    // Try to extract instrument ID
    const instrumentId = firstTrade['1'] || firstTrade[1]
    console.log(`🔍 Testing instrument fetching for ID: ${instrumentId}\n`)

    if (!instrumentId) {
      console.log('❌ No instrument ID found in trade data')
      return
    }

    // Test the getInstrumentDetails function
    console.log('Testing getInstrumentDetails function...')
    const instrumentDetails = await tradelockerService.getInstrumentDetails(
      authResult.accessToken,
      instrumentId,
      accNum,
      ENVIRONMENT
    )

    if (instrumentDetails) {
      console.log('✅ Instrument details retrieved:')
      console.log(JSON.stringify(instrumentDetails, null, 2))
    } else {
      console.log('❌ Failed to get instrument details')
    }

    // Also try fetching all instruments to see the structure
    console.log('\n\n🔍 Testing /trade/instruments endpoint (all instruments)...')
    const baseUrl = ENVIRONMENT === 'live' 
      ? 'https://live.tradelocker.com/backend-api'
      : 'https://demo.tradelocker.com/backend-api'
    
    try {
      const response = await fetch(`${baseUrl}/trade/instruments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authResult.accessToken}`,
          'accNum': String(accNum),
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ All instruments endpoint response structure:')
        console.log('Response keys:', Object.keys(data))
        
        const instruments = data.d?.instruments || data.d || data.instruments || data
        console.log(`Found ${Array.isArray(instruments) ? instruments.length : 'N/A'} instruments`)
        
        if (Array.isArray(instruments) && instruments.length > 0) {
          // Find our instrument
          const ourInstrument = instruments.find(inst => 
            String(inst.id || inst.tradableInstrumentId) === String(instrumentId)
          )
          
          if (ourInstrument) {
            console.log('\n✅ Found our instrument in the list:')
            console.log(JSON.stringify(ourInstrument, null, 2))
          } else {
            console.log('\n⚠️  Our instrument not found in list. Showing first 3 instruments as sample:')
            instruments.slice(0, 3).forEach((inst, idx) => {
              console.log(`\nInstrument ${idx + 1}:`)
              console.log(JSON.stringify(inst, null, 2))
            })
          }
        } else {
          console.log('Response structure:', JSON.stringify(data, null, 2).substring(0, 500))
        }
      } else {
        console.log(`❌ All instruments endpoint returned: ${response.status}`)
        const errorText = await response.text()
        console.log('Error response:', errorText.substring(0, 200))
      }
    } catch (error) {
      console.log(`❌ Error fetching all instruments: ${error.message}`)
    }

    // Test individual instrument endpoint
    console.log('\n\n🔍 Testing individual instrument endpoint...')
    const endpoints = [
      `${baseUrl}/trade/instruments/${instrumentId}`,
      `${baseUrl}/trade/instruments/${instrumentId}/details`,
      `${baseUrl}/trade/symbols/${instrumentId}`,
    ]

    for (const url of endpoints) {
      try {
        console.log(`\nTrying: ${url}`)
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authResult.accessToken}`,
            'accNum': String(accNum),
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Success! Response structure:`)
          console.log(JSON.stringify(data, null, 2))
          break
        } else {
          console.log(`  Status: ${response.status}`)
          const errorText = await response.text()
          console.log(`  Error: ${errorText.substring(0, 200)}`)
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`)
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ Test complete!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testInstrumentFetching()
