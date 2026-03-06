/**
 * Test script to fetch TradeLocker API data
 * Usage: node test-tradelocker-api.js
 * 
 * Set these environment variables:
 * TRADELOCKER_EMAIL=your@email.com
 * TRADELOCKER_PASSWORD=yourpassword
 * TRADELOCKER_SERVER=your-server-name
 * TRADELOCKER_ENV=live (or demo)
 * TRADELOCKER_ACCOUNT_ID=692284
 */

const TRADELOCKER_BASE_URL = {
  live: 'https://live.tradelocker.com/backend-api',
  demo: 'https://demo.tradelocker.com/backend-api'
}

async function testTradeLockerAPI() {
  const email = process.env.TRADELOCKER_EMAIL
  const password = process.env.TRADELOCKER_PASSWORD
  const server = process.env.TRADELOCKER_SERVER
  const environment = process.env.TRADELOCKER_ENV || 'live'
  const accountId = process.env.TRADELOCKER_ACCOUNT_ID || '692284'

  if (!email || !password || !server) {
    console.error('Missing required environment variables:')
    console.error('TRADELOCKER_EMAIL, TRADELOCKER_PASSWORD, TRADELOCKER_SERVER')
    console.error('\nExample:')
    console.error('TRADELOCKER_EMAIL=your@email.com TRADELOCKER_PASSWORD=pass TRADELOCKER_SERVER="TradeLocker-Live" TRADELOCKER_ENV=live node test-tradelocker-api.js')
    process.exit(1)
  }

  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live

  try {
    console.log('🔐 Step 1: Authenticating with TradeLocker...')
    console.log(`   Email: ${email}`)
    console.log(`   Server: ${server}`)
    console.log(`   Environment: ${environment}`)
    console.log(`   Base URL: ${baseUrl}\n`)

    // Authenticate
    const authResponse = await fetch(`${baseUrl}/auth/jwt/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, server })
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('❌ Authentication failed:', authResponse.status, errorText)
      process.exit(1)
    }

    const authData = await authResponse.json()
    const accessToken = authData.accessToken || authData.access_token || authData.token
    console.log('✅ Authentication successful!\n')

    // Get accounts
    console.log('📋 Step 2: Fetching accounts...')
    const accountsResponse = await fetch(`${baseUrl}/auth/jwt/all-accounts`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json()
      const accounts = accountsData.accounts || accountsData || []
      console.log(`✅ Found ${accounts.length} account(s)`)
      
      const account = accounts.find(acc => (acc.accountId || acc.id) === accountId) || accounts[0]
      const accNum = account?.accNum || account?.accountNumber || 0
      
      console.log(`   Selected Account ID: ${accountId}`)
      console.log(`   Account Number: ${accNum}`)
      console.log(`   Account data:`, JSON.stringify(account, null, 2))
      console.log()

      // Test balance endpoints
      console.log('💰 Step 3: Testing balance endpoints...')
      const balanceEndpoints = [
        `/trade/accounts/${accountId}/info`,
        `/trade/accounts/${accountId}/balance`,
        `/trade/accounts/${accountId}/account`,
        `/trade/accounts/${accountId}`,
        `/trade/accounts/${accountId}/summary`,
      ]

      const commonHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        'accNum': String(accNum),
        'Content-Type': 'application/json'
      }

      for (const endpoint of balanceEndpoints) {
        try {
          const url = `${baseUrl}${endpoint}`
          console.log(`   Testing: ${endpoint}`)
          const response = await fetch(url, {
            method: 'GET',
            headers: commonHeaders
          })

          if (response.ok) {
            const data = await response.json()
            console.log(`   ✅ ${endpoint} - Status: ${response.status}`)
            console.log(`   Response structure:`, JSON.stringify(data, null, 2).substring(0, 500))
            console.log()
          } else {
            console.log(`   ❌ ${endpoint} - Status: ${response.status}`)
            const errorText = await response.text()
            if (errorText) console.log(`   Error: ${errorText.substring(0, 200)}`)
            console.log()
          }
        } catch (err) {
          console.log(`   ❌ ${endpoint} - Error: ${err.message}\n`)
        }
      }

      // Test trades endpoint
      console.log('📊 Step 4: Testing trades endpoint...')
      const tradesUrl = `${baseUrl}/trade/accounts/${accountId}/ordersHistory`
      console.log(`   Testing: ${tradesUrl}`)
      
      const tradesResponse = await fetch(tradesUrl, {
        method: 'GET',
        headers: commonHeaders
      })

      if (tradesResponse.ok) {
        const tradesData = await tradesResponse.json()
        console.log(`   ✅ Status: ${tradesResponse.status}`)
        console.log(`   Response keys:`, Object.keys(tradesData))
        
        const d = tradesData.d || tradesData
        console.log(`   Data keys:`, Array.isArray(d) ? `array[${d.length}]` : Object.keys(d))
        
        if (!Array.isArray(d)) {
          Object.keys(d).forEach(k => {
            if (Array.isArray(d[k])) {
              console.log(`   ${k}: array[${d[k].length}]`)
            }
          })
        }

        const trades = d.ordersHistory || d.positionsHistory || (Array.isArray(d) ? d : [])
        console.log(`   Total trades found: ${trades.length}`)
        
        if (trades.length > 0) {
          console.log(`\n   📝 Sample trade (first one):`)
          const sampleTrade = trades[0]
          console.log(`   Trade keys:`, Object.keys(sampleTrade))
          console.log(`   Trade structure:`, JSON.stringify(sampleTrade, null, 2).substring(0, 1000))
          
          // Try to identify key fields
          console.log(`\n   🔍 Field analysis:`)
          Object.keys(sampleTrade).slice(0, 25).forEach(key => {
            const value = sampleTrade[key]
            const valueType = typeof value
            const valuePreview = valueType === 'object' ? JSON.stringify(value).substring(0, 50) : String(value).substring(0, 50)
            console.log(`      ${key}: ${valueType} = ${valuePreview}`)
          })
        }
      } else {
        console.log(`   ❌ Status: ${tradesResponse.status}`)
        const errorText = await tradesResponse.text()
        console.log(`   Error: ${errorText}`)
      }

    } else {
      console.error('❌ Failed to fetch accounts:', accountsResponse.status)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  }
}

testTradeLockerAPI()
