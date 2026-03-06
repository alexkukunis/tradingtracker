/**
 * Test script to fetch and display TradeLocker trade config
 * This shows us the actual field names used in API responses
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testTradeConfig() {
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

    console.log('📋 Fetching trade config...\n')
    const config = await tradelockerService.getTradeConfig(
      authResult.accessToken, ACCOUNT_ID, accNum, ENVIRONMENT
    )

    if (!config) {
      console.log('❌ Could not fetch trade config')
      return
    }

    console.log('✅ Trade Config Retrieved:\n')
    console.log('=' .repeat(80))
    console.log(JSON.stringify(config, null, 2))
    console.log('=' .repeat(80))

    // Look for field definitions related to orders/trades
    console.log('\n🔍 Looking for order/trade field definitions...\n')
    
    if (config.orderFields || config.orderFieldsConfig) {
      console.log('Order Fields:', JSON.stringify(config.orderFields || config.orderFieldsConfig, null, 2))
    }
    
    if (config.tradeFields || config.tradeFieldsConfig) {
      console.log('Trade Fields:', JSON.stringify(config.tradeFields || config.tradeFieldsConfig, null, 2))
    }

    // Check for P&L related fields
    const allKeys = Object.keys(config)
    console.log('\n📊 All config keys:', allKeys.join(', '))
    
    // Look for anything that might indicate field mappings
    for (const key of allKeys) {
      if (key.toLowerCase().includes('field') || 
          key.toLowerCase().includes('config') ||
          key.toLowerCase().includes('metadata') ||
          key.toLowerCase().includes('order') ||
          key.toLowerCase().includes('trade')) {
        console.log(`\n${key}:`, JSON.stringify(config[key], null, 2))
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testTradeConfig()
