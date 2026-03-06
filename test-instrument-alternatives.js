/**
 * Test alternative ways to get instrument information from TradeLocker
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testInstrumentAlternatives() {
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

    // Test 1: Try trade config endpoint
    console.log('🔍 Test 1: Trade Config Endpoint\n')
    const configEndpoints = [
      `${baseUrl}/trade/config`,
      `${baseUrl}/trade/accounts/${ACCOUNT_ID}/config`,
      `${baseUrl}/config`,
      `${baseUrl}/trade/config/metadata`,
      `${baseUrl}/trade/config/instruments`,
    ]

    for (const url of configEndpoints) {
      try {
        console.log(`Trying: ${url}`)
        const response = await fetch(url, {
          method: 'GET',
          headers: commonHeaders
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Success! Response keys:`, Object.keys(data))
          console.log('Sample data:', JSON.stringify(data, null, 2).substring(0, 1000))
          break
        } else {
          console.log(`  Status: ${response.status}`)
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`)
      }
    }

    // Test 2: Try different instrument endpoint variations
    console.log('\n\n🔍 Test 2: Alternative Instrument Endpoints\n')
    const instrumentId = '3366'
    const altEndpoints = [
      `${baseUrl}/trade/instrument/${instrumentId}`,
      `${baseUrl}/trade/instrument/${instrumentId}/info`,
      `${baseUrl}/trade/symbol/${instrumentId}`,
      `${baseUrl}/trade/symbols`,
      `${baseUrl}/trade/instruments/list`,
      `${baseUrl}/trade/instruments/all`,
      `${baseUrl}/trade/market/instruments`,
      `${baseUrl}/trade/account/${ACCOUNT_ID}/instruments`,
    ]

    for (const url of altEndpoints) {
      try {
        console.log(`Trying: ${url}`)
        const response = await fetch(url, {
          method: 'GET',
          headers: commonHeaders
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Success! Response structure:`)
          console.log('Keys:', Object.keys(data))
          const instruments = data.d?.instruments || data.d || data.instruments || data
          if (Array.isArray(instruments)) {
            console.log(`Found ${instruments.length} instruments`)
            if (instruments.length > 0) {
              const found = instruments.find(inst => 
                String(inst.id || inst.tradableInstrumentId || inst.instrumentId) === String(instrumentId)
              )
              if (found) {
                console.log('\n✅ Found our instrument:')
                console.log(JSON.stringify(found, null, 2))
              } else {
                console.log('\nFirst instrument sample:')
                console.log(JSON.stringify(instruments[0], null, 2))
              }
            }
          } else {
            console.log('Response:', JSON.stringify(data, null, 2).substring(0, 1000))
          }
          break
        } else {
          console.log(`  Status: ${response.status}`)
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`)
      }
    }

    // Test 3: Check if instrument info is in the trade data itself
    console.log('\n\n🔍 Test 3: Check if instrument info is in trade data\n')
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    if (closedPositions.length > 0) {
      const firstTrade = closedPositions[0]
      console.log('Checking all fields in first trade for instrument-related data:')
      Object.keys(firstTrade).forEach(key => {
        const val = firstTrade[key]
        if (typeof val === 'string' && (
          val.includes('NAS') || 
          val.includes('EUR') || 
          val.includes('USD') || 
          val.includes('GBP') ||
          val.length < 10 && !isNaN(val)
        )) {
          console.log(`  [${key}]: ${val}`)
        }
      })
    }

    // Test 4: Try account info endpoint - might have instrument list
    console.log('\n\n🔍 Test 4: Account Info Endpoints\n')
    const accountEndpoints = [
      `${baseUrl}/trade/accounts/${ACCOUNT_ID}`,
      `${baseUrl}/trade/accounts/${ACCOUNT_ID}/info`,
      `${baseUrl}/trade/accounts/${ACCOUNT_ID}/details`,
      `${baseUrl}/trade/accounts/${ACCOUNT_ID}/summary`,
    ]

    for (const url of accountEndpoints) {
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
          console.log('Sample:', JSON.stringify(data, null, 2).substring(0, 500))
        } else {
          console.log(`  Status: ${response.status}`)
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`)
      }
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

testInstrumentAlternatives()
