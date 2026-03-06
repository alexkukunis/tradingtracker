/**
 * Test the new instrument endpoints using the correct TradeLocker API
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testNewInstrumentEndpoints() {
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
    
    console.log(`📊 Account: ${account?.accountId || account?.id} (Acc# ${accNum})\n`)

    // Test 1: Get all instruments
    console.log('🔍 Test 1: getAllInstruments()\n')
    try {
      const allInstruments = await tradelockerService.getAllInstruments(
        authResult.accessToken,
        ACCOUNT_ID,
        accNum,
        ENVIRONMENT
      )
      
      console.log(`✅ Successfully fetched ${allInstruments.size} instruments\n`)
      
      // Show first 10 instruments
      let count = 0
      for (const [id, symbol] of allInstruments.entries()) {
        if (count < 10) {
          console.log(`  ${id} → ${symbol}`)
          count++
        }
      }
      if (allInstruments.size > 10) {
        console.log(`  ... and ${allInstruments.size - 10} more`)
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`)
    }

    // Test 2: Get instrument details for a specific ID
    console.log('\n\n🔍 Test 2: getInstrumentDetails() for specific ID\n')
    
    // Get an instrument ID from trades
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )
    
    if (closedPositions.length > 0) {
      const instrumentId = closedPositions[0]['1'] || closedPositions[0][1]
      console.log(`Testing with instrument ID: ${instrumentId}\n`)
      
      try {
        const instrumentDetails = await tradelockerService.getInstrumentDetails(
          authResult.accessToken,
          instrumentId,
          ACCOUNT_ID,
          accNum,
          ENVIRONMENT
        )
        
        if (instrumentDetails) {
          console.log('✅ Successfully fetched instrument details:')
          console.log(JSON.stringify(instrumentDetails, null, 2))
        } else {
          console.log('❌ No instrument details returned')
        }
      } catch (error) {
        console.error(`❌ Error: ${error.message}`)
      }
    }

    // Test 3: Test with multiple instrument IDs from trades
    console.log('\n\n🔍 Test 3: Testing with multiple instrument IDs from trades\n')
    const instrumentIds = new Set()
    for (let i = 0; i < Math.min(10, closedPositions.length); i++) {
      const instId = closedPositions[i]['1'] || closedPositions[i][1]
      if (instId) instrumentIds.add(String(instId))
    }
    
    console.log(`Found ${instrumentIds.size} unique instrument IDs: ${Array.from(instrumentIds).join(', ')}\n`)
    
    // Get all instruments and map them
    try {
      const allInstruments = await tradelockerService.getAllInstruments(
        authResult.accessToken,
        ACCOUNT_ID,
        accNum,
        ENVIRONMENT
      )
      
      console.log('Mapping instrument IDs to symbols:')
      for (const instId of instrumentIds) {
        const symbol = allInstruments.get(instId)
        if (symbol) {
          console.log(`  ✅ ${instId} → ${symbol}`)
        } else {
          console.log(`  ❌ ${instId} → Not found`)
        }
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`)
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

testNewInstrumentEndpoints()
