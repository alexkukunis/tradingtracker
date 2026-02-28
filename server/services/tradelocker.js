/**
 * TradeLocker API Service
 * Handles authentication and data syncing with TradeLocker
 *
 * IMPORTANT: TradeLocker separates two concepts:
 *   - environment: "live" or "demo" — determines which base URL to use
 *   - server (serverName): the actual broker server name the user logs into
 *     e.g. "TradeLocker-Live", "OSP-Server1", "FTMO-Server3"
 *     This is the value the user sees when they log in to TradeLocker.
 */

const TRADELOCKER_BASE_URL = {
  live: 'https://live.tradelocker.com/backend-api',
  demo: 'https://demo.tradelocker.com/backend-api'
}

/**
 * Authenticate with TradeLocker and get JWT tokens
 * @param {string} email - TradeLocker account email
 * @param {string} password - TradeLocker account password
 * @param {string} serverName - The actual broker server name (e.g. "TradeLocker-Live")
 * @param {string} environment - "live" or "demo" (determines base URL)
 */
export async function authenticateTradeLocker(email, password, serverName, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live

  try {
    const response = await fetch(`${baseUrl}/auth/jwt/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        server: serverName  // Must be the actual broker server name, NOT "live"/"demo"
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const msg = errorData.message || errorData.error || `Authentication failed: ${response.status}`
      throw new Error(msg)
    }

    const data = await response.json()
    return {
      accessToken: data.accessToken || data.access_token || data.token,
      refreshToken: data.refreshToken || data.refresh_token || null,
      expiresIn: data.expiresIn || data.expires_in || 3600,
      expiresAt: data.expiresAt
        ? new Date(data.expiresAt)
        : new Date(Date.now() + (data.expiresIn || 3600) * 1000)
    }
  } catch (error) {
    console.error('TradeLocker authentication error:', error)
    throw new Error(`Failed to authenticate with TradeLocker: ${error.message}`)
  }
}

/**
 * Refresh an access token using the refresh token
 * @param {string} refreshToken
 * @param {string} environment - "live" or "demo"
 */
export async function refreshAccessToken(refreshToken, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live

  try {
    // Try with refresh token in body first (some APIs require this)
    let response = await fetch(`${baseUrl}/auth/jwt/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })

    // If that fails, try with Authorization header
    if (!response.ok && response.status !== 400) {
      response = await fetch(`${baseUrl}/auth/jwt/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`
        }
      })
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.message || errorData.error || `Token refresh failed: ${response.status}`
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return {
      accessToken: data.accessToken || data.access_token || data.token,
      expiresIn: data.expiresIn || data.expires_in || 3600,
      expiresAt: data.expiresAt
        ? new Date(data.expiresAt)
        : new Date(Date.now() + (data.expiresIn || 3600) * 1000)
    }
  } catch (error) {
    console.error('TradeLocker token refresh error:', error)
    throw new Error(`Failed to refresh TradeLocker token: ${error.message}`)
  }
}

/**
 * Get all accounts for the authenticated user
 * @param {string} accessToken
 * @param {string} environment - "live" or "demo"
 */
export async function getTradeLockerAccounts(accessToken, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live

  try {
    const response = await fetch(`${baseUrl}/auth/jwt/all-accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to fetch accounts: ${response.status}`)
    }

    const data = await response.json()
    return data.accounts || data || []
  } catch (error) {
    console.error('TradeLocker get accounts error:', error)
    throw new Error(`Failed to fetch TradeLocker accounts: ${error.message}`)
  }
}

/**
 * Get account balance and summary
 * @param {string} accessToken
 * @param {string} accountId
 * @param {number} accNum
 * @param {string} environment - "live" or "demo"
 */
export async function getAccountBalance(accessToken, accountId, accNum, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live
  
  // TradeLocker provides balance in the all-accounts endpoint
  // This is more reliable than the account-specific endpoints which return 404
  try {
    const accounts = await getTradeLockerAccounts(accessToken, environment)
    const account = accounts.find(acc => (acc.accountId || acc.id) === accountId || acc.id === accountId)
    
    if (account) {
      // accountBalance is provided as a string, convert to number
      const balance = parseFloat(account.accountBalance || account.balance || 0)
      const equity = parseFloat(account.equity || account.accountBalance || account.balance || balance || 0)
      
      if (balance > 0 || equity > 0) {
        console.log(`Found balance from all-accounts: balance=${balance}, equity=${equity}`)
        return {
          balance: balance,
          equity: equity,
          margin: parseFloat(account.margin || account.usedMargin || 0),
          freeMargin: parseFloat(account.freeMargin || account.availableMargin || 0)
        }
      }
    }
  } catch (err) {
    console.warn('Could not get balance from all-accounts:', err.message)
  }

  // Fallback: Try account-specific endpoints (though they typically return 404)
  const commonHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'accNum': String(accNum),
    'Content-Type': 'application/json'
  }

  const endpoints = [
    `${baseUrl}/trade/accounts/${accountId}/info`,
    `${baseUrl}/trade/accounts/${accountId}/balance`,
    `${baseUrl}/trade/accounts/${accountId}/account`,
    `${baseUrl}/trade/accounts/${accountId}`,
    `${baseUrl}/trade/accounts/${accountId}/summary`,
  ]

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { method: 'GET', headers: commonHeaders })
      if (response.ok) {
        const data = await response.json()
        const d = data.d || data
        
        const balance = parseFloat(d.balance || d.equity || d.accountBalance || 0)
        const equity = parseFloat(d.equity || d.balance || d.accountBalance || balance || 0)
        
        if (balance > 0 || equity > 0) {
          return {
            balance: balance,
            equity: equity,
            margin: parseFloat(d.margin || d.usedMargin || 0),
            freeMargin: parseFloat(d.freeMargin || d.availableMargin || 0)
          }
        }
      }
    } catch (err) {
      // Continue to next endpoint
    }
  }

  // Return zeros if all endpoints fail — don't block the sync
  console.warn('Could not fetch account balance; proceeding with sync anyway')
  return { balance: 0, equity: 0, margin: 0, freeMargin: 0 }
}

/**
 * Get trade config metadata to understand field names used in API responses
 * @param {string} accessToken
 * @param {string} accountId
 * @param {number} accNum
 * @param {string} environment - "live" or "demo"
 */
export async function getTradeConfig(accessToken, accountId, accNum, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live

  const commonHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'accNum': String(accNum),
    'Content-Type': 'application/json'
  }

  // Try different possible config endpoints
  const endpoints = [
    `${baseUrl}/trade/config`,
    `${baseUrl}/trade/accounts/${accountId}/config`,
    `${baseUrl}/config`,
    `${baseUrl}/trade/config/metadata`
  ]

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: commonHeaders
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ Trade config retrieved from: ${url}`)
        return data
      }
    } catch (error) {
      // Continue to next endpoint
    }
  }

  console.warn('Could not fetch trade config from any endpoint')
  return null
}

/**
 * Get closed positions/trades history
 * @param {string} accessToken
 * @param {string} accountId
 * @param {number} accNum
 * @param {string} environment - "live" or "demo"
 * @param {string|null} startDate
 * @param {string|null} endDate
 */
export async function getClosedPositions(accessToken, accountId, accNum, environment = 'live', startDate = null, endDate = null) {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live
  // accNum must be sent as a header per TradeLocker API spec
  const commonHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'accNum': String(accNum),
    'Content-Type': 'application/json'
  }

  const dateParams = new URLSearchParams()
  if (startDate) dateParams.append('startTime', startDate)
  if (endDate) dateParams.append('endTime', endDate)
  const qs = dateParams.toString() ? `?${dateParams.toString()}` : ''

  // ordersHistory is the confirmed correct endpoint for TradeLocker closed trades.
  // positionsHistory is a fallback for brokers that store trades differently.
  const endpoints = [
    `${baseUrl}/trade/accounts/${accountId}/ordersHistory${qs}`,
    `${baseUrl}/trade/accounts/${accountId}/positionsHistory${qs}`,
  ]

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { method: 'GET', headers: commonHeaders })

      // 429 = rate limited — wait 2 seconds and retry once before giving up
      if (response.status === 429) {
        console.warn(`Rate limited on ${url} — retrying in 2s...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        const retry = await fetch(url, { method: 'GET', headers: commonHeaders })
        if (retry.ok) {
          const data = await retry.json()
          const d = data.d || data
          console.log(`${url} (retry) d keys:`, Array.isArray(d) ? `array[${d.length}]` : Object.keys(d))
          const trades = d.positionsHistory || d.ordersHistory || d.orders || d.positions || d.history || d.closedPositions || (Array.isArray(d) ? d : [])
          console.log(`→ extracted ${trades.length} trades after retry`)
          if (trades.length > 0) {
            const firstTrade = trades[0]
            const tradeKeys = Object.keys(firstTrade)
            console.log('  First trade keys (retry):', tradeKeys)
            // Log P&L-related fields for debugging
            const pnlFields = ['realizedPnL', 'realizedProfit', 'profit', 'pnl', '10']
            const foundPnlFields = pnlFields.filter(field => 
              firstTrade[field] !== undefined && firstTrade[field] !== null
            )
            if (foundPnlFields.length > 0) {
              console.log('  P&L fields found (retry):', foundPnlFields.map(f => `${f}=${firstTrade[f]}`).join(', '))
            }
          }
          return trades
        }
        console.warn(`Still rate limited after retry on ${url}`)
        continue
      }

      if (response.ok) {
        const data = await response.json()
        const d = data.d || data
        const allKeys = Array.isArray(d) ? `array[${d.length}]` : Object.keys(d)
        console.log(`${url} → d keys:`, allKeys)

        // Log length of every array field for debugging
        if (!Array.isArray(d)) {
          Object.keys(d).forEach(k => {
            if (Array.isArray(d[k])) console.log(`  d.${k}: ${d[k].length} items`)
          })
        }

        // TradeLocker field names for closed trades vary by endpoint
        // ordersHistory endpoint typically returns ordersHistory array or direct array
        const trades = d.positionsHistory  // positionsHistory endpoint
          || d.ordersHistory               // ordersHistory endpoint (filled orders with P&L)
          || d.orders
          || d.positions
          || d.history
          || d.closedPositions
          || (Array.isArray(d) ? d : [])

        console.log(`→ extracted ${trades.length} trades`)
        if (trades.length > 0) {
          const firstTrade = trades[0]
          const tradeKeys = Object.keys(firstTrade)
          console.log('  First trade keys:', tradeKeys)
          // Log P&L-related fields for debugging
          const pnlFields = ['realizedPnL', 'realizedProfit', 'profit', 'pnl', '10']
          const foundPnlFields = pnlFields.filter(field => 
            firstTrade[field] !== undefined && firstTrade[field] !== null
          )
          if (foundPnlFields.length > 0) {
            console.log('  P&L fields found:', foundPnlFields.map(f => `${f}=${firstTrade[f]}`).join(', '))
          }
        }
        return trades
      }
      console.warn(`Closed positions endpoint ${url} returned ${response.status}`)
    } catch (err) {
      console.warn(`Closed positions endpoint ${url} error:`, err.message)
    }
  }

  // Return empty instead of throwing — no closed positions is a valid state
  console.warn('No closed positions found from any TradeLocker endpoint')
  return []
}

/**
 * Determine the P&L contract multiplier for an instrument.
 *
 * TradeLocker ordersHistory returns raw price-diff × qty but NOT the realized P&L.
 * The realized P&L = priceDiff × qty × contractSize × fxRate.
 *
 * Verified multipliers for HEROFX (confirmed against live API):
 *   NAS100 / NAS100.PRO  → contractSize=1,   currency=USD  → multiplier = 1
 *   XAUUSD (Gold)        → contractSize=100, currency=USD  → multiplier = 100
 *   DE40 / DE40.PRO      → contractSize=100, currency=EUR  → multiplier = 100 × EUR/USD
 *
 * @param {string} symbol    - Instrument name (e.g. "DE40.PRO", "XAUUSD", "NAS100")
 * @param {Object} fxRates   - Live FX rates: { EURUSD, GBPUSD, ... } (default 1.0)
 * @returns {number} The multiplier to apply to (priceDiff × qty)
 */
export function getContractMultiplier(symbol, fxRates = {}, instrumentType = '') {
  if (!symbol) return 1
  const s = symbol.toUpperCase().replace(/[.\s_]/g, '') // normalise

  // ── Precious metals (100 oz per standard lot, USD-denominated) ─────────────
  if (s.startsWith('XAU') || s.startsWith('XAG') ||
      s.includes('GOLD') || s.includes('SILVER')) {
    return 100
  }

  // ── European equity indices (100 EUR per point per lot) ────────────────────
  const eurIndices = ['DE40', 'GER40', 'DE30', 'GER30', 'DAX',
                      'FRA40', 'CAC40', 'ESP35', 'EU50', 'STOXX50',
                      'STOXX', 'AEX', 'SMI', 'IBEX', 'MIB', 'FTSEMIB']
  if (eurIndices.some(idx => s.includes(idx))) {
    return 100 * (fxRates.EURUSD || 1)
  }

  // ── UK equity index (100 GBP per point per lot) ────────────────────────────
  const gbpIndices = ['UK100', 'FTSE', 'UKX']
  if (gbpIndices.some(idx => s.includes(idx))) {
    return 100 * (fxRates.GBPUSD || 1)
  }

  // ── FOREX pairs (100,000 units per standard lot) ───────────────────────────
  // Detect: instrument type is FOREX, or symbol looks like a 6-char currency pair
  const isForex = instrumentType === 'FOREX' ||
                  (!instrumentType && /^[A-Z]{6}(\.PRO)?$/.test(s))
  if (isForex) {
    // Quote currency = last 3 chars of the base symbol (strip .PRO suffix)
    const base = s.replace('PRO', '')
    const quoteCcy = base.slice(-3)
    // Convert P&L from quote currency to USD
    const quoteCcyToUSD = {
      'USD': 1,
      'EUR': fxRates.EURUSD || 1,
      'GBP': fxRates.GBPUSD || 1,
      'AUD': fxRates.AUDUSD || 1,
      'NZD': fxRates.NZDUSD || 1,
      'CAD': fxRates.CADUSD || (1 / (fxRates.USDCAD || 1)),
      'CHF': fxRates.CHFUSD || (1 / (fxRates.USDCHF || 1)),
      'JPY': fxRates.JPYUSD || (1 / (fxRates.USDJPY || 100)),
      'SGD': fxRates.SGDUSD || (1 / (fxRates.USDSGD || 1.3)),
    }
    const convRate = quoteCcyToUSD[quoteCcy] ?? 1
    return 100000 * convRate
  }

  // ── All other instruments (US indices NAS100/US30/US500, Crypto…) ──────────
  // contractSize = 1 (USD per point per lot)
  return 1
}

/**
 * Fetch the live bid/ask quote for an instrument via the INFO route.
 * The INFO route (not the TRADE route) serves market data for quotes.
 *
 * @param {string} accessToken
 * @param {string|number} tradableInstrumentId
 * @param {string|number} infoRouteId  - The route whose type === "INFO"
 * @param {number} accNum
 * @param {string} environment
 * @returns {Promise<{bid: number, ask: number} | null>}
 */
export async function getLiveQuote(accessToken, tradableInstrumentId, infoRouteId, accNum, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live
  try {
    const resp = await fetch(
      `${baseUrl}/trade/quotes?tradableInstrumentId=${tradableInstrumentId}&routeId=${infoRouteId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'accNum': String(accNum),
          'Content-Type': 'application/json'
        }
      }
    )
    if (!resp.ok) return null
    const data = await resp.json()
    if (data.s !== 'ok' || !data.d) return null
    return {
      bid: parseFloat(data.d.bp || data.d.bid || 0),
      ask: parseFloat(data.d.ap || data.d.ask || 0)
    }
  } catch {
    return null
  }
}

/**
 * Fetch live FX rates needed for P&L conversion (EUR/USD, GBP/USD).
 * Uses the INFO route of the respective currency pair instruments.
 *
 * @param {string} accessToken
 * @param {string} accountId
 * @param {number} accNum
 * @param {string} environment
 * @returns {Promise<{EURUSD: number, GBPUSD: number}>}
 */
export async function getFXRates(accessToken, accountId, accNum, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live
  const rates = {
    EURUSD: 1.0, GBPUSD: 1.0, AUDUSD: 1.0, NZDUSD: 1.0,
    USDCAD: 1.0, USDCHF: 1.0, USDJPY: 100.0,
    // Derived convenience aliases
    CADUSD: 1.0, CHFUSD: 1.0, JPYUSD: 0.01,
    // Per-instrument spread (used to correct P&L to TL mid-price basis)
    // Key: symbol.toUpperCase() → live spread (ask - bid)
    spreads: {}
  }

  try {
    const resp = await fetch(`${baseUrl}/trade/accounts/${accountId}/instruments`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'accNum': String(accNum),
        'Content-Type': 'application/json'
      }
    })
    if (!resp.ok) return rates

    const data = await resp.json()
    const instruments = data.d?.instruments || data.instruments || []

    // Currency pairs to fetch — key is the rate name, names is the symbol to look for
    const targets = [
      { key: 'EURUSD',  names: ['EURUSD',  'EUR/USD'] },
      { key: 'GBPUSD',  names: ['GBPUSD',  'GBP/USD'] },
      { key: 'AUDUSD',  names: ['AUDUSD',  'AUD/USD'] },
      { key: 'NZDUSD',  names: ['NZDUSD',  'NZD/USD'] },
      { key: 'USDCAD',  names: ['USDCAD',  'USD/CAD'] },
      { key: 'USDCHF',  names: ['USDCHF',  'USD/CHF'] },
      { key: 'USDJPY',  names: ['USDJPY',  'USD/JPY'] },
      // Equity + metal instruments — fetch spread so we can apply mid-price correction
      { key: '_NAS100', names: ['NAS100', 'NAS100.PRO', 'USA100'] },
      { key: '_XAUUSD', names: ['XAUUSD', 'GOLD', 'XAU/USD'] },
      { key: '_DE40',   names: ['DE40.PRO', 'DE40', 'GER40'] },
    ]

    for (const { key, names } of targets) {
      const inst = instruments.find(i =>
        names.some(n => (i.name || i.symbol || '').toUpperCase() === n.toUpperCase())
      )
      if (!inst) continue

      const infoRoute = (inst.routes || []).find(r => r.type === 'INFO')
      if (!infoRoute) continue

      const instId = inst.tradableInstrumentId || inst.id
      const quote = await getLiveQuote(accessToken, instId, infoRoute.id, accNum, environment)
      if (!quote || quote.bid <= 0) continue

      const mid = (quote.bid + quote.ask) / 2
      const spread = quote.ask - quote.bid

      if (key.startsWith('_')) {
        // Store spread for equity/metal instruments
        const sym = names[0].toUpperCase().replace(/[.\s_]/g, '')
        rates.spreads[sym] = spread
        console.log(`✅  Live spread ${names[0]} = ${spread.toFixed(4)} (ask=${quote.ask} bid=${quote.bid})`)
      } else {
        rates[key] = mid
        console.log(`✅  Live FX rate ${key} = ${mid.toFixed(5)}`)
      }
    }

    // Derive convenience aliases
    rates.CADUSD = rates.USDCAD > 0 ? 1 / rates.USDCAD : 1
    rates.CHFUSD = rates.USDCHF > 0 ? 1 / rates.USDCHF : 1
    rates.JPYUSD = rates.USDJPY > 0 ? 1 / rates.USDJPY : 0.01
  } catch (err) {
    console.warn('getFXRates error (non-fatal):', err.message)
  }

  return rates
}

/**
 * Get all instruments available to the account — returns Map<instId, symbol>
 * @returns {Promise<Map<string, string>>}
 */
export async function getAllInstruments(accessToken, accountId, accNum, environment = 'live') {
  const full = await getAllInstrumentsFull(accessToken, accountId, accNum, environment)
  const symbolMap = new Map()
  for (const [id, info] of full) symbolMap.set(id, info.symbol)
  return symbolMap
}

/**
 * Get all instruments with full metadata (symbol + type) needed for P&L calculation.
 * @returns {Promise<Map<string, {symbol: string, type: string}>>}
 */
export async function getAllInstrumentsFull(accessToken, accountId, accNum, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live
  const instrumentMap = new Map()

  try {
    const response = await fetch(`${baseUrl}/trade/accounts/${accountId}/instruments`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'accNum': String(accNum),
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      const instruments = data.d?.instruments || data.d || data.instruments || []

      if (Array.isArray(instruments)) {
        for (const instrument of instruments) {
          const instId = String(instrument.tradableInstrumentId || instrument.id || instrument.instrumentId || '')
          const symbol = instrument.symbol || instrument.name || instrument.instrumentName || null
          const type   = instrument.type || instrument.instrumentType || ''

          if (instId && symbol) {
            instrumentMap.set(instId, { symbol, type })
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to fetch all instruments:', error.message)
  }

  return instrumentMap
}

/**
 * Get instrument details by tradableInstrumentId
 * Uses the correct TradeLocker API endpoints
 * @param {string} accessToken
 * @param {string} tradableInstrumentId
 * @param {string} accountId
 * @param {number} accNum
 * @param {string} environment - "live" or "demo"
 */
export async function getInstrumentDetails(accessToken, tradableInstrumentId, accountId, accNum, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live
  const commonHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'accNum': String(accNum),
    'Content-Type': 'application/json'
  }

  // First, try the specific instrument endpoint
  try {
    const response = await fetch(`${baseUrl}/trade/instruments/${tradableInstrumentId}`, {
      method: 'GET',
      headers: commonHeaders
    })

    if (response.ok) {
      const data = await response.json()
      const d = data.d || data
      const symbol = d.symbol || d.name || d.instrumentName || null
      
      if (symbol) {
        return {
          id: d.id || d.tradableInstrumentId || tradableInstrumentId,
          symbol: symbol,
          name: d.name || symbol,
          description: d.description || null
        }
      }
    }
  } catch (error) {
    // Continue to fallback
  }

  // Fallback: fetch all instruments and find the one we need
  try {
    const allInstruments = await getAllInstruments(accessToken, accountId, accNum, environment)
    const symbol = allInstruments.get(String(tradableInstrumentId))
    
    if (symbol) {
      return {
        id: tradableInstrumentId,
        symbol: symbol,
        name: symbol,
        description: null
      }
    }
  } catch (error) {
    // Ignore
  }

  return null
}

/**
 * Get open positions
 * @param {string} accessToken
 * @param {string} accountId
 * @param {number} accNum
 * @param {string} environment - "live" or "demo"
 */
export async function getOpenPositions(accessToken, accountId, accNum, environment = 'live') {
  const baseUrl = TRADELOCKER_BASE_URL[environment] || TRADELOCKER_BASE_URL.live
  const commonHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'accNum': String(accNum),
    'Content-Type': 'application/json'
  }

  try {
    const response = await fetch(`${baseUrl}/trade/accounts/${accountId}/positions`, {
      method: 'GET',
      headers: commonHeaders
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch open positions: ${response.status}`)
    }

    const data = await response.json()
    const d = data.d || data
    return d.positions || (Array.isArray(d) ? d : [])
  } catch (error) {
    console.error('TradeLocker get open positions error:', error)
    throw new Error(`Failed to fetch open positions: ${error.message}`)
  }
}

/**
 * Normalize TradeLocker trade data - handles both array format with numeric indices and object format
 *
 * OFFICIAL field mapping per /trade/config → ordersHistoryConfig (verified against live API):
 *  [0]  id                   — Order ID
 *  [1]  tradableInstrumentId — Instrument ID (use to look up symbol)
 *  [2]  routeId              — Broker route ID (NOT positionId!)
 *  [3]  qty                  — Volume / Amount
 *  [4]  side                 — "buy" or "sell"
 *  [5]  type                 — "market", "limit", "stop"
 *  [6]  status               — "Filled", "Cancelled", etc.
 *  [7]  filledQty            — Filled quantity
 *  [8]  avgPrice             — Average fill price = Entry price
 *  [9]  price                — Limit/stop trigger price (NOT exit price)
 *  [10] stopPrice            — Stop trigger for stop orders (NOT the SL price!)
 *  [11] validity             — Time in force (GTC, IOC, etc.)
 *  [12] expireDate           — Order expiry date (NOT takeProfit!)
 *  [13] createdDate          — Order creation timestamp ms = Entry time
 *  [14] lastModified         — Last-modified timestamp ms
 *  [15] isOpen               — "true" if this order opened a position, "false" if it closed one
 *  [16] positionId           — Position ID (links all orders for one position)
 *  [17] stopLoss             — Stop Loss price ← the actual SL level
 *  [18] stopLossType         — Stop Loss type ("absolute", etc.)
 *  [19] takeProfit           — Take Profit price ← the actual TP level
 *  [20] takeProfitType       — Take Profit type
 *  [21] strategyId           — Strategy ID (NOT P&L — P&L is not in ordersHistory!)
 *
 * ⚠️  P&L, Fee, and Swap are NOT returned by the ordersHistory endpoint.
 *     Use groupPositionOrders() to combine open+close orders, then calculate P&L from prices.
 */
export function normalizeTradeLockerTrade(tradeData) {
  // Check if it's an array or object with numeric keys
  const keys = Object.keys(tradeData)
  const hasNumericKeys = keys.length > 0 && keys.every(k => !isNaN(parseInt(k)))
  
  if (hasNumericKeys && keys.length >= 15) {
    // Correct index mappings per official /trade/config ordersHistoryConfig
    const get = (i) => {
      const v = tradeData[String(i)] !== undefined ? tradeData[String(i)] : tradeData[i]
      return (v !== null && v !== undefined && v !== '') ? v : null
    }

    const stopLossVal   = get(17) // [17] = stopLoss  ← actual SL price
    const takeProfitVal = get(19) // [19] = takeProfit ← actual TP price
    // Commission, swap, and realized P&L are NOT in ordersHistory — always 0
    const stopLoss   = stopLossVal   !== null ? parseFloat(stopLossVal)   : 0
    const takeProfit = takeProfitVal !== null ? parseFloat(takeProfitVal) : 0

    return {
      ticket:               get(0),                                // Order ID
      tradableInstrumentId: get(1),                                // Instrument ID
      routeId:              get(2),                                // Route/broker ID
      volume:               parseFloat(get(3) || 0),              // qty
      type:                 (get(4) || '').toLowerCase(),          // side: 'buy' or 'sell'
      orderType:            (get(5) || '').toLowerCase(),          // 'market', 'limit', 'stop'
      status:               (get(6) || '').toLowerCase(),          // 'filled', 'cancelled'…
      filledQty:            parseFloat(get(7) || 0),
      openPrice:            parseFloat(get(8) || 0),              // avgPrice = fill/entry price
      limitTriggerPrice:    parseFloat(get(9) || 0),              // price (limit trigger)
      stopTriggerPrice:     parseFloat(get(10) || 0),             // stopPrice (stop trigger)
      timeInForce:          get(11) || '',                         // validity (GTC, IOC…)
      expireDate:           get(12),                               // order expiry
      openTime:             get(13),                               // createdDate (ms) = entry time
      lastModified:         get(14),                               // lastModified (ms)
      isOpen:               String(get(15) || '').toLowerCase() === 'true', // true = opened position
      positionId:           get(16),                               // [16] = positionId ✅
      stopPrice:            stopLoss,                              // [17] stopLoss = SL price
      stopLossType:         get(18) || '',                         // [18] stopLossType
      takeProfit:           takeProfit,                            // [19] takeProfit = TP price
      takeProfitType:       get(20) || '',                         // [20] takeProfitType
      strategyId:           get(21),                               // [21] strategyId (not P&L!)
      // Derived / compatibility aliases
      accountNum:           null,                                  // not in ordersHistory
      closePrice:           0,                                     // only available after grouping
      closeTime:            null,                                  // only available after grouping
      parentOrderId:        get(16),                               // alias for positionId
      profit:               0,                                     // not in ordersHistory — calculate
      swap:                 0,                                     // not in ordersHistory
      commission:           0,                                     // not in ordersHistory
      netProfit:            0,                                     // calculated after grouping
      _original: tradeData
    }
  }
  
  // If it's already in object format, normalize it to extract P&L and other fields
  // The ordersHistory endpoint returns object format with named fields
  // Check for various possible P&L field names that TradeLocker API might use
  const profit = parseFloat(
    tradeData.realizedPnL || 
    tradeData.realizedProfit || 
    tradeData.realizedPnl ||
    tradeData.profit || 
    tradeData.pnl || 
    tradeData.PnL ||
    tradeData.Profit ||
    tradeData.closedPnL ||
    tradeData.closedProfit ||
    tradeData.closedPnl ||
    tradeData['21'] || tradeData[21] ||
    0
  )
  
  // Extract Stop Loss and Take Profit
  const stopPrice = parseFloat(
    tradeData.stopPrice || 
    tradeData.stopLoss || 
    tradeData.slPrice ||
    tradeData.sl ||
    tradeData['10'] || tradeData[10] ||
    0
  )
  
  const takeProfit = parseFloat(
    tradeData.takeProfit || 
    tradeData.tpPrice ||
    tradeData.tp ||
    tradeData['12'] || tradeData[12] ||
    0
  )
  
  // Extract Fee/Commission and Swap
  const commission = parseFloat(
    tradeData.commission || 
    tradeData.commissionFee || 
    tradeData.fee ||
    tradeData['20'] || tradeData[20] ||
    0
  )
  
  const swap = parseFloat(
    tradeData.swap || 
    tradeData.swapFee || 
    tradeData['19'] || tradeData[19] ||
    0
  )
  
  // Extract Position ID
  const positionId = tradeData.positionId || 
                     tradeData.positionID || 
                     tradeData['2'] || 
                     tradeData[2] || 
                     null
  
  // Extract other fields with fallbacks for different field name variations
  return {
    ticket: tradeData.ticket || tradeData.orderId || tradeData.id || tradeData.orderID || tradeData['0'] || tradeData[0] || null, // Order ID
    accountNum: tradeData.accountNum || tradeData.accountNumber || tradeData.accNum || tradeData['1'] || tradeData[1] || null,
    positionId: positionId, // Position ID
    id: tradeData.id || tradeData.orderId || tradeData.ticket || tradeData['0'] || tradeData[0] || null,
    volume: parseFloat(tradeData.volume || tradeData.lotSize || tradeData.size || tradeData.quantity || tradeData.amount || tradeData['3'] || tradeData[3] || 0), // Amount
    type: (tradeData.type || tradeData.side || tradeData.direction || tradeData['4'] || tradeData[4] || '').toLowerCase(), // Side: 'buy' or 'sell'
    orderType: (tradeData.orderType || tradeData.type || tradeData['5'] || tradeData[5] || '').toLowerCase(), // Type: 'market', 'limit', etc.
    status: (tradeData.status || tradeData.state || tradeData['6'] || tradeData[6] || '').toLowerCase(),
    openPrice: parseFloat(tradeData.openPrice || tradeData.open || tradeData.entryPrice || tradeData.avgPrice || tradeData['8'] || tradeData[8] || 0), // Entry Price
    closePrice: parseFloat(tradeData.closePrice || tradeData.close || tradeData.exitPrice || tradeData.price || tradeData['9'] || tradeData[9] || 0), // Exit Price
    stopPrice: stopPrice, // SL Price
    takeProfit: takeProfit, // TP Price
    profit: profit, // P&L (gross)
    tradableInstrumentId: tradeData.tradableInstrumentId || tradeData.instrumentId || tradeData.symbolId || tradeData['1'] || tradeData[1] || null,
    timeInForce: tradeData.timeInForce || tradeData['11'] || tradeData[11] || '',
    openTime: tradeData.openTime || tradeData.openTimestamp || tradeData.openDate || tradeData.entryTime || tradeData['13'] || tradeData[13] || null, // Entry Time
    closeTime: tradeData.closeTime || tradeData.closeTimestamp || tradeData.closeDate || tradeData.exitTime || tradeData['14'] || tradeData[14] || null, // Exit Time
    parentOrderId: tradeData.parentOrderId || tradeData.parentId || tradeData['16'] || tradeData[16] || null,
    price: parseFloat(tradeData.price || tradeData.executionPrice || tradeData['17'] || tradeData[17] || 0),
    stopLossType: tradeData.stopLossType || tradeData['18'] || tradeData[18] || '',
    swap: swap, // Swap
    commission: commission, // Fee/Commission
    // Calculate Net P&L = P&L - Fee - Swap (if fee is negative, add it; if positive, subtract it)
    netProfit: profit - Math.abs(commission) - swap,
    // Store original for reference
    _original: tradeData
  }
}

/**
 * Group raw ordersHistory orders into complete closed positions.
 *
 * TradeLocker ordersHistory returns individual orders, not positions.
 * A single closed position is represented by multiple linked orders:
 *   - 1 opening fill  : status=Filled, isOpen=true  (side matches position direction)
 *   - 1+ bracket orders: stop/limit, usually Cancelled when position closes
 *   - 1 closing fill  : status=Filled, isOpen=false (opposite side)
 *
 * All orders for the same position share the same positionId at index [16].
 *
 * ⚠️  TradeLocker ordersHistory does NOT include realized P&L.
 *     P&L is calculated here using:
 *       grossPnl = priceDiff × qty × contractMultiplier
 *     where contractMultiplier = getContractMultiplier(symbol, fxRates).
 *
 *     Verified multipliers for HEROFX (from live API diagnostics):
 *       NAS100 / NAS100.PRO  → ×1   (USD, contractSize=1 per lot)
 *       XAUUSD (Gold)        → ×100 (USD, 100 oz per lot)
 *       DE40 / DE40.PRO      → ×100 × EUR/USD rate (EUR-denominated, 100 EUR/point/lot)
 *
 * @param {Array}                orders        - Raw array from ordersHistory
 * @param {Map<string, string>}  instrumentMap - Optional: instId → symbol name
 * @param {Object}               fxRates       - Optional: { EURUSD, GBPUSD } live rates
 * @returns {Array} Array of composite closed-position objects
 */
export function groupPositionOrders(orders, instrumentMap = new Map(), fxRates = {}, instrumentFullMap = new Map()) {
  const groups = new Map()

  for (const order of orders) {
    const posId = String(order['16'] ?? order[16] ?? '').trim()
    if (!posId) continue
    if (!groups.has(posId)) groups.set(posId, [])
    groups.get(posId).push(order)
  }

  const closedPositions = []

  for (const [positionId, posOrders] of groups) {
    const get = (order, i) => {
      const v = order[String(i)] !== undefined ? order[String(i)] : order[i]
      return (v !== null && v !== undefined && v !== '') ? v : null
    }

    // Opening fill: Filled AND isOpen=true (this order opened the position)
    const openingFills = posOrders.filter(o => {
      const status = String(get(o, 6) || '').toLowerCase()
      const isOpen = String(get(o, 15) || '').toLowerCase()
      return status === 'filled' && isOpen === 'true'
    })

    // Closing fills: Filled AND isOpen=false (this order closed the position)
    const closingFills = posOrders.filter(o => {
      const status = String(get(o, 6) || '').toLowerCase()
      const isOpen = String(get(o, 15) || '').toLowerCase()
      return status === 'filled' && isOpen === 'false'
    })

    // Need at least one of each to have a complete closed position
    if (openingFills.length === 0 || closingFills.length === 0) continue

    // If multiple opening fills, pick the one with the earliest createdDate
    const openOrder = openingFills.sort(
      (a, b) => Number(get(a, 13) || 0) - Number(get(b, 13) || 0)
    )[0]

    // If multiple closing fills, pick the one with the latest createdDate
    const closeOrder = closingFills.sort(
      (a, b) => Number(get(b, 13) || 0) - Number(get(a, 13) || 0)
    )[0]

    const side        = String(get(openOrder, 4) || '').toLowerCase()   // 'buy' or 'sell'
    const orderType   = String(get(openOrder, 5) || '').toLowerCase()   // 'market', etc.
    const qty         = parseFloat(get(openOrder, 3) || 0)
    const entryPrice  = parseFloat(get(openOrder, 8) || 0)             // avgPrice
    const exitPrice   = parseFloat(get(closeOrder, 8) || 0)            // avgPrice
    const entryTimeMs = get(openOrder, 13)                              // createdDate ms
    const exitTimeMs  = get(closeOrder, 13)                             // createdDate ms of close fill
    const instId      = String(get(openOrder, 1) || '')                 // tradableInstrumentId
    const symbol      = instrumentMap.get(instId) || ''                 // e.g. "DE40.PRO"
    const instType    = instrumentFullMap.get(instId)?.type || ''       // e.g. "FOREX", "EQUITY_CFD"

    // Primary source: [17] stopLoss and [19] takeProfit on the opening order
    let stopLoss   = parseFloat(get(openOrder, 17) || 0) || null   // [17] = stopLoss
    let takeProfit = parseFloat(get(openOrder, 19) || 0) || null   // [19] = takeProfit

    // Fallback: TradeLocker sometimes omits [17]/[19] on the opening fill and instead
    // encodes SL/TP as cancelled GTC bracket orders linked by the same positionId.
    //
    // For a SELL position the closing brackets are BUY orders:
    //   SL bracket = buy STOP  (GTC, cancelled) → price [9] = SL level
    //   TP bracket = buy LIMIT (GTC, cancelled) → price [9] = TP level
    //
    // For a BUY position the closing brackets are SELL orders:
    //   SL bracket = sell STOP  (GTC, cancelled) → price [9] = SL level
    //   TP bracket = sell LIMIT (GTC, cancelled) → price [9] = TP level
    const oppositeSide = side === 'sell' ? 'buy' : 'sell'
    const bracketOrders = posOrders.filter(o => {
      const oSide   = String(get(o, 4) || '').toLowerCase()
      const oStatus = String(get(o, 6) || '').toLowerCase()
      const oValidity = String(get(o, 11) || '').toUpperCase()
      // Must be opposite side, cancelled (or pending), and GTC
      return oSide === oppositeSide &&
             (oStatus === 'cancelled' || oStatus === 'pending' || oStatus === '') &&
             oValidity === 'GTC'
    })

    for (const bracket of bracketOrders) {
      const bracketType  = String(get(bracket, 5) || '').toLowerCase()
      const bracketPrice = parseFloat(get(bracket, 9) || 0) || null  // price [9]
      if (!bracketPrice) continue
      if (bracketType === 'stop'  && stopLoss   === null) stopLoss   = bracketPrice
      if (bracketType === 'limit' && takeProfit === null) takeProfit = bracketPrice
    }

    // Calculate gross P&L.
    // ordersHistory has no realized P&L field — we derive it from price difference.
    // The correct formula is: priceDiff × qty × contractMultiplier
    // where the multiplier accounts for contractSize and currency conversion.
    // e.g.  NAS100 → ×1   |  XAUUSD → ×100   |  DE40.PRO → ×100 × EUR/USD
    let grossPnl = 0
    if (entryPrice > 0 && exitPrice > 0 && qty > 0) {
      const priceDiff = side === 'sell'
        ? (entryPrice - exitPrice)
        : (exitPrice - entryPrice)
      const multiplier = getContractMultiplier(symbol, fxRates, instType)
      grossPnl = priceDiff * qty * multiplier
      // Log only when a non-trivial multiplier is applied (helps trace P&L issues)
      if (symbol && multiplier !== 1) {
        console.log(`  P&L calc: ${symbol} (${instType||'?'}) | diff=${priceDiff.toFixed(4)} × qty=${qty} × mult=${multiplier.toFixed(4)} = $${grossPnl.toFixed(2)}`)
      }
    }

    // The "Order ID" shown in the TradeLocker UI corresponds to the closing order ID
    const closingOrderId = String(get(closeOrder, 0) || '')

    closedPositions.push({
      // Named fields — picked up by normalizeTradeLockerTrade object-format branch
      positionId,
      ticket:               closingOrderId,
      orderId:              closingOrderId,
      tradableInstrumentId: instId,
      side,                                   // used by normaliser as 'type'
      type:                 side,             // alias so both field names work
      orderType,
      qty,
      volume:               qty,              // alias
      avgPrice:             entryPrice,       // picked up as openPrice
      openPrice:            entryPrice,
      closePrice:           exitPrice,
      exitPrice,
      stopLoss,                               // picked up as stopPrice/SL
      stopPrice:            stopLoss,         // alias
      takeProfit,
      openTime:             entryTimeMs,      // entry timestamp ms
      openDate:             entryTimeMs,      // alias
      entryTime:            entryTimeMs,
      closeTime:            exitTimeMs,       // exit timestamp ms
      closeDate:            exitTimeMs,
      exitTime:             exitTimeMs,
      status:               'filled',
      profit:               Math.round(grossPnl * 100) / 100,
      netProfit:            Math.round(grossPnl * 100) / 100, // fee/swap not in API
      commission:           0,               // not available in ordersHistory
      swap:                 0,               // not available in ordersHistory
      // Internal refs
      _openOrder:  openOrder,
      _closeOrder: closeOrder,
      _allOrders:  posOrders,
    })
  }

  // Sort by exit time ascending (oldest first)
  return closedPositions.sort(
    (a, b) => Number(a.closeTime || 0) - Number(b.closeTime || 0)
  )
}

/**
 * Transform TradeLocker position/trade data to our Trade model format
 * @param {Object} tradeData - Raw trade data from TradeLocker API
 * @param {number} openBalance - Starting balance for this trade
 * @param {Object} settings - User settings (riskPercent, riskReward)
 * @param {string|null} instrumentSymbol - Optional instrument symbol name (e.g. "NAS100")
 */
export function transformTradeLockerTrade(tradeData, openBalance, settings, instrumentSymbol = null) {
  // Normalize the trade data first (handles array format with numeric indices and object format)
  const normalized = normalizeTradeLockerTrade(tradeData)
  
  // Extract P&L - prioritize Net P&L (P&L - Fee - Swap) if available, otherwise use gross P&L
  // Net P&L is what actually affects the account balance
  let pnl = parseFloat(normalized.netProfit) || parseFloat(normalized.profit) || 0
  const status = (normalized.status || '').toLowerCase()
  
  // Only calculate PnL from price difference as a fallback if:
  // 1. The profit field is 0 or missing
  // 2. The trade is filled/closed
  // 3. We have valid prices and volume
  const isFilled = status === 'filled' || status === 'closed' || status === 'executed' || status === 'complete'
  
  // If profit is 0 or missing, try calculating from price difference for filled trades
  // This is a fallback - the ordersHistory endpoint should provide the actual realized P&L
  if (Math.abs(pnl) < 0.0001 && isFilled && normalized.openPrice > 0 && normalized.closePrice > 0 && normalized.volume > 0) {
    const openPrice = parseFloat(normalized.openPrice)
    const closePrice = parseFloat(normalized.closePrice)
    const volume = parseFloat(normalized.volume)
    const type = (normalized.type || '').toLowerCase()
    
    if (type === 'buy') {
      // For BUY: profit = (closePrice - openPrice) * volume
      pnl = (closePrice - openPrice) * volume
    } else if (type === 'sell') {
      // For SELL: profit = (openPrice - closePrice) * volume
      pnl = (openPrice - closePrice) * volume
    }
    
    // Subtract fees and add swap to get net P&L
    const commission = parseFloat(normalized.commission) || 0
    const swap = parseFloat(normalized.swap) || 0
    pnl = pnl - Math.abs(commission) + swap
  }
  
  // If still 0 and not filled, keep it as 0 (cancelled/pending trades)

  // Get close date - TradeLocker provides timestamps in milliseconds
  let closeTime = normalized.closeTime
  let openTime = normalized.openTime
  
  // Convert to Date - timestamps are in milliseconds
  let closeDate
  if (closeTime) {
    try {
      // Ensure it's treated as a number (might be string)
      const closeTimeMs = typeof closeTime === 'string' ? parseInt(closeTime, 10) : Number(closeTime)
      
      // Validate the timestamp is reasonable (not NaN, not 0, and within a valid date range)
      if (!isNaN(closeTimeMs) && closeTimeMs > 0 && closeTimeMs < Number.MAX_SAFE_INTEGER) {
        closeDate = new Date(closeTimeMs)
        // Double-check the date is valid
        if (isNaN(closeDate.getTime())) {
          throw new Error('Invalid date from timestamp')
        }
      } else {
        throw new Error('Invalid timestamp value')
      }
    } catch (error) {
      // If closeTime is invalid, try openTime
      if (openTime) {
        try {
          const openTimeMs = typeof openTime === 'string' ? parseInt(openTime, 10) : Number(openTime)
          if (!isNaN(openTimeMs) && openTimeMs > 0 && openTimeMs < Number.MAX_SAFE_INTEGER) {
            closeDate = new Date(openTimeMs)
            if (isNaN(closeDate.getTime())) {
              throw new Error('Invalid date from openTime')
            }
          } else {
            throw new Error('Invalid openTime timestamp')
          }
        } catch (err) {
          console.warn('Invalid timestamps from TradeLocker trade, using current date:', { closeTime, openTime, error: err.message })
          closeDate = new Date()
        }
      } else {
        console.warn('No valid timestamps from TradeLocker trade, using current date:', { closeTime, openTime })
        closeDate = new Date()
      }
    }
  } else if (openTime) {
    try {
      const openTimeMs = typeof openTime === 'string' ? parseInt(openTime, 10) : Number(openTime)
      if (!isNaN(openTimeMs) && openTimeMs > 0 && openTimeMs < Number.MAX_SAFE_INTEGER) {
        closeDate = new Date(openTimeMs)
        if (isNaN(closeDate.getTime())) {
          throw new Error('Invalid date from openTime')
        }
      } else {
        throw new Error('Invalid openTime timestamp')
      }
    } catch (error) {
      console.warn('Invalid openTime from TradeLocker trade, using current date:', { openTime, error: error.message })
      closeDate = new Date()
    }
  } else {
    console.warn('No timestamps from TradeLocker trade, using current date')
    closeDate = new Date()
  }

  // Calculate metrics using existing calculation function
  const riskPercent = settings.riskPercent || 2
  const riskReward = settings.riskReward || 3
  const riskDollar = (openBalance * riskPercent) / 100
  const targetDollar = riskDollar * riskReward
  const percentGain = openBalance > 0 ? (pnl / openBalance) * 100 : 0
  const closeBalance = openBalance + pnl
  const rrAchieved = riskDollar > 0 ? pnl / riskDollar : 0
  const targetHit = pnl >= targetDollar

  // Get day name
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = dayNames[closeDate.getDay()]

  // Build notes from available data with all relevant trade information
  const type = normalized.type || '' // 'buy' or 'sell'
  const orderType = normalized.orderType || '' // 'market', 'limit', etc.
  const volume = normalized.volume || 0
  const instrumentId = normalized.tradableInstrumentId || null
  const symbol = instrumentSymbol || normalized.instrumentSymbol || null
  
  // Build comprehensive notes with all trade details
  const parts = []
  
  // Instrument symbol/name
  if (symbol) {
    parts.push(symbol)
  } else if (instrumentId) {
    parts.push(`Instrument ${instrumentId}`)
  }
  
  // Trade type and side
  const side = type === 'buy' ? 'Buy' : type === 'sell' ? 'Sell' : ''
  const orderTypeStr = orderType ? orderType.charAt(0).toUpperCase() + orderType.slice(1) : ''
  if (side && orderTypeStr) {
    parts.push(`${side} ${volume} ${orderTypeStr}`)
  } else if (side) {
    parts.push(`${side} ${volume}`)
  }
  
  // Entry/Exit prices
  if (normalized.openPrice > 0 && normalized.closePrice > 0) {
    parts.push(`Entry: ${normalized.openPrice.toFixed(2)}`)
    parts.push(`Exit: ${normalized.closePrice.toFixed(2)}`)
  }
  
  // Stop Loss and Take Profit - show N/A if not set (0 or null)
  // This helps the UI distinguish between "not set" and "set to 0"
  if (normalized.stopPrice && normalized.stopPrice > 0) {
    parts.push(`SL: ${normalized.stopPrice.toFixed(2)}`)
  } else {
    parts.push(`SL: N/A`)
  }
  if (normalized.takeProfit && normalized.takeProfit > 0) {
    parts.push(`TP: ${normalized.takeProfit.toFixed(2)}`)
  } else {
    parts.push(`TP: N/A`)
  }
  
  // Fees and Swap - always include them (show 0.00 or N/A if not set)
  const commission = parseFloat(normalized.commission) || 0
  const swap = parseFloat(normalized.swap) || 0
  // Always include Fee and Swap in notes so UI can display them
  if (commission !== 0 || normalized.commission !== null) {
    parts.push(`Fee: $${commission.toFixed(2)}`)
  } else {
    parts.push(`Fee: N/A`)
  }
  if (swap !== 0 || normalized.swap !== null) {
    parts.push(`Swap: $${swap.toFixed(2)}`)
  } else {
    parts.push(`Swap: N/A`)
  }
  
  // Order ID and Position ID
  if (normalized.ticket) {
    parts.push(`Order: ${normalized.ticket}`)
  }
  if (normalized.positionId) {
    parts.push(`Position: ${normalized.positionId}`)
  }
  
  let notes = parts.length > 0 ? parts.join(' | ') : 'TradeLocker trade'

  // Get trade ID for duplicate detection
  const tradeId = normalized.ticket || normalized.id || normalized.parentOrderId || null

  // Dedicated SL/TP fields — read directly from the normalized trade.
  // stopPrice maps to field [17] (stopLoss), takeProfit maps to field [19].
  // Store null (not 0) when not set so the UI can distinguish "not set" from 0.
  const stopLossValue   = normalized.stopPrice  && normalized.stopPrice  > 0 ? Math.round(normalized.stopPrice  * 100000) / 100000 : null
  const takeProfitValue = normalized.takeProfit && normalized.takeProfit > 0 ? Math.round(normalized.takeProfit * 100000) / 100000 : null

  return {
    date: closeDate,
    day: day,
    pnl: Math.round(pnl * 100) / 100,
    openBalance: Math.round(openBalance * 100) / 100,
    closeBalance: Math.round(closeBalance * 100) / 100,
    percentGain: Math.round(percentGain * 100) / 100,
    riskDollar: Math.round(riskDollar * 100) / 100,
    targetDollar: Math.round(targetDollar * 100) / 100,
    rrAchieved: Math.round(rrAchieved * 100) / 100,
    targetHit,
    notes: notes || 'TradeLocker trade',
    result: targetHit && pnl > 0 ? 'Target Achieved' : (pnl > 0 ? 'Win' : (pnl < 0 ? 'Loss' : 'Breakeven')),
    // Dedicated Stop Loss / Take Profit price fields (from TradeLocker API fields [17] and [19])
    stopLoss:   stopLossValue,
    takeProfit: takeProfitValue,
    // Store TradeLocker trade ID to avoid duplicates
    tradelockerTradeId: tradeId ? String(tradeId) : null
  }
}
