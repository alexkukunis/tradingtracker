/**
 * Test script to verify TradeLocker data mapping
 * This simulates the sync process and shows what data will be created
 */

import * as tradelockerService from './server/services/tradelocker.js'

const EMAIL = 'kukunisalex@gmail.com'
const PASSWORD = '6w+U^hgbm?'
const SERVER = 'HEROFX'
const ENVIRONMENT = 'live'
const ACCOUNT_ID = '692284'

async function testMapping() {
  try {
    console.log('🔐 Step 1: Authenticating with TradeLocker...\n')
    
    // Authenticate
    const authResult = await tradelockerService.authenticateTradeLocker(
      EMAIL,
      PASSWORD,
      SERVER,
      ENVIRONMENT
    )
    console.log('✅ Authentication successful!\n')

    // Get accounts
    console.log('📋 Step 2: Fetching accounts...\n')
    const accounts = await tradelockerService.getTradeLockerAccounts(
      authResult.accessToken,
      ENVIRONMENT
    )
    
    const account = accounts.find(acc => (acc.accountId || acc.id) === ACCOUNT_ID) || accounts[0]
    const accNum = parseInt(account?.accNum || account?.accountNumber || 0, 10)
    
    console.log(`✅ Found account:`)
    console.log(`   Account ID: ${ACCOUNT_ID}`)
    console.log(`   Account Number: ${accNum}`)
    console.log(`   Balance: $${account?.accountBalance || 'N/A'}\n`)

    // Get balance
    console.log('💰 Step 3: Fetching account balance...\n')
    const balanceData = await tradelockerService.getAccountBalance(
      authResult.accessToken,
      ACCOUNT_ID,
      accNum,
      ENVIRONMENT
    )
    console.log('✅ Balance data:')
    console.log(JSON.stringify(balanceData, null, 2))
    console.log()

    // Get trades
    console.log('📊 Step 4: Fetching trade history...\n')
    const closedPositions = await tradelockerService.getClosedPositions(
      authResult.accessToken,
      ACCOUNT_ID,
      accNum,
      ENVIRONMENT
    )
    
    console.log(`✅ Found ${closedPositions.length} trades\n`)

    if (closedPositions.length === 0) {
      console.log('⚠️  No trades found to test mapping')
      return
    }

    // Show raw trade structure
    console.log('📝 Step 5: Analyzing raw trade structure...\n')
    const sampleRawTrade = closedPositions[0]
    console.log('Raw trade (first one):')
    console.log(JSON.stringify(sampleRawTrade, null, 2))
    console.log()

    // Test transformation with sample trades
    console.log('🔄 Step 6: Testing trade transformation...\n')
    
    // Use a sample starting balance
    const startingBalance = parseFloat(account?.accountBalance || 1000)
    const settings = {
      riskPercent: 2,
      riskReward: 3,
      startingBalance: startingBalance
    }

    // Transform first 5 trades
    console.log('Transforming first 5 trades:\n')
    const transformedTrades = []
    let currentBalance = startingBalance

    for (let i = 0; i < Math.min(5, closedPositions.length); i++) {
      const rawTrade = closedPositions[i]
      const transformed = tradelockerService.transformTradeLockerTrade(
        rawTrade,
        currentBalance,
        settings
      )
      transformedTrades.push(transformed)
      currentBalance = transformed.closeBalance

      console.log(`\n--- Trade ${i + 1} ---`)
      console.log(JSON.stringify(transformed, null, 2))
    }

    // Validate required fields for Dashboard and Trade History
    console.log('\n\n✅ Step 7: Validating required fields...\n')
    
    const requiredFields = [
      'date',
      'day',
      'pnl',
      'openBalance',
      'closeBalance',
      'percentGain',
      'riskDollar',
      'targetDollar',
      'rrAchieved',
      'targetHit',
      'notes',
      'result',
      'tradelockerTradeId'
    ]

    const sampleTransformed = transformedTrades[0]
    const missingFields = requiredFields.filter(field => !(field in sampleTransformed))
    
    if (missingFields.length === 0) {
      console.log('✅ All required fields are present!')
    } else {
      console.log('❌ Missing fields:', missingFields)
    }

    // Check data types
    console.log('\n📋 Step 8: Validating data types...\n')
    const validations = {
      'date is Date': sampleTransformed.date instanceof Date,
      'day is string': typeof sampleTransformed.day === 'string',
      'pnl is number': typeof sampleTransformed.pnl === 'number',
      'openBalance is number': typeof sampleTransformed.openBalance === 'number',
      'closeBalance is number': typeof sampleTransformed.closeBalance === 'number',
      'percentGain is number': typeof sampleTransformed.percentGain === 'number',
      'tradelockerTradeId is string or null': typeof sampleTransformed.tradelockerTradeId === 'string' || sampleTransformed.tradelockerTradeId === null
    }

    Object.entries(validations).forEach(([check, result]) => {
      console.log(`${result ? '✅' : '❌'} ${check}: ${result}`)
    })

    // Summary statistics
    console.log('\n\n📊 Step 9: Summary Statistics...\n')
    const allTransformed = []
    let testBalance = startingBalance
    
    // Transform all trades to get statistics
    for (const rawTrade of closedPositions.slice(0, 100)) { // Test first 100 for speed
      const transformed = tradelockerService.transformTradeLockerTrade(
        rawTrade,
        testBalance,
        settings
      )
      allTransformed.push(transformed)
      testBalance = transformed.closeBalance
    }

    const wins = allTransformed.filter(t => t.pnl > 0).length
    const losses = allTransformed.filter(t => t.pnl < 0).length
    const totalPnL = allTransformed.reduce((sum, t) => sum + t.pnl, 0)
    const dates = allTransformed.map(t => t.date).filter(d => d instanceof Date)

    console.log(`Total trades tested: ${allTransformed.length}`)
    console.log(`Wins: ${wins}`)
    console.log(`Losses: ${losses}`)
    console.log(`Total PnL: $${totalPnL.toFixed(2)}`)
    console.log(`Valid dates: ${dates.length}/${allTransformed.length}`)
    console.log(`Date range: ${dates.length > 0 ? new Date(Math.min(...dates)).toLocaleDateString() : 'N/A'} to ${dates.length > 0 ? new Date(Math.max(...dates)).toLocaleDateString() : 'N/A'}`)

    console.log('\n\n✨ Mapping test complete!')
    console.log('If all validations passed, you can proceed with the sync.\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testMapping()
