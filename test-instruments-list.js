/**
 * Test the instruments/list endpoint with proper parameters
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testInstrumentsList() {
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

    // Get a few instrument IDs from trades
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    const instrumentIds = new Set()
    for (let i = 0; i < Math.min(10, closedPositions.length); i++) {
      const instId = closedPositions[i]['1'] || closedPositions[i][1]
      if (instId) instrumentIds.add(String(instId))
    }

    console.log(`Found ${instrumentIds.size} unique instrument IDs:`, Array.from(instrumentIds))
    console.log()

    // Test 1: Try instruments/list with query parameter
    console.log('🔍 Test 1: /trade/instruments/list with query parameter\n')
    const testId = Array.from(instrumentIds)[0]
    const url1 = `${baseUrl}/trade/instruments/list?tradableInstrumentId=${testId}`
    console.log(`Trying: ${url1}`)
    
    try {
      const response = await fetch(url1, {
        method: 'GET',
        headers: commonHeaders
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Success!')
        console.log(JSON.stringify(data, null, 2))
      } else {
        console.log(`Status: ${response.status}`)
        const errorText = await response.text()
        console.log('Error:', errorText)
      }
    } catch (error) {
      console.log(`Error: ${error.message}`)
    }

    // Test 2: Try instruments/list without parameter (get all)
    console.log('\n\n🔍 Test 2: /trade/instruments/list (all instruments)\n')
    const url2 = `${baseUrl}/trade/instruments/list`
    console.log(`Trying: ${url2}`)
    
    try {
      const response = await fetch(url2, {
        method: 'GET',
        headers: commonHeaders
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Success!')
        console.log('Response keys:', Object.keys(data))
        const instruments = data.d?.instruments || data.d || data.instruments || data
        if (Array.isArray(instruments)) {
          console.log(`Found ${instruments.length} instruments`)
          
          // Find our instruments
          console.log('\nLooking for our instrument IDs:')
          for (const instId of instrumentIds) {
            const found = instruments.find(inst => 
              String(inst.id || inst.tradableInstrumentId || inst.instrumentId) === String(instId)
            )
            if (found) {
              console.log(`\n✅ Found instrument ${instId}:`)
              console.log(JSON.stringify(found, null, 2))
            } else {
              console.log(`❌ Instrument ${instId} not found`)
            }
          }
          
          // Show first 3 as samples
          if (instruments.length > 0) {
            console.log('\n\nSample instruments (first 3):')
            instruments.slice(0, 3).forEach((inst, idx) => {
              console.log(`\nInstrument ${idx + 1}:`)
              console.log(JSON.stringify(inst, null, 2))
            })
          }
        } else {
          console.log('Response:', JSON.stringify(data, null, 2).substring(0, 2000))
        }
      } else {
        console.log(`Status: ${response.status}`)
        const errorText = await response.text()
        console.log('Error:', errorText)
      }
    } catch (error) {
      console.log(`Error: ${error.message}`)
    }

    // Test 3: Try POST with body
    console.log('\n\n🔍 Test 3: /trade/instruments/list with POST body\n')
    const url3 = `${baseUrl}/trade/instruments/list`
    console.log(`Trying POST: ${url3}`)
    
    try {
      const response = await fetch(url3, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({ tradableInstrumentId: parseInt(testId) })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Success!')
        console.log(JSON.stringify(data, null, 2))
      } else {
        console.log(`Status: ${response.status}`)
        const errorText = await response.text()
        console.log('Error:', errorText)
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

testInstrumentsList()
