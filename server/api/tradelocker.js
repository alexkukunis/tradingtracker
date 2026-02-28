import express from 'express'
import prisma from '../../prisma/client.js'
import { authenticateToken } from '../middleware/auth.js'
import * as tradelockerService from '../services/tradelocker.js'
import crypto from 'crypto'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Encryption key for TradeLocker passwords (should be in env in production)
// SHA-256 hash ensures we always have exactly 32 bytes for AES-256-CBC,
// regardless of the format or length of the ENCRYPTION_KEY env variable.
const ENCRYPTION_KEY_RAW = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const KEY_BUFFER = crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest()
const ALGORITHM = 'aes-256-cbc'

function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid encrypted text')
    }
    const parts = text.split(':')
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format')
    }
    const iv = Buffer.from(parts[0], 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv)
    let decrypted = decipher.update(parts[1], 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error.message)
    throw new Error('Failed to decrypt stored credentials. Please reconnect your TradeLocker account.')
  }
}

// Connect TradeLocker account
// Requires: email, password, server (actual broker server name), environment ("live"|"demo"), accountId (optional)
router.post('/connect', async (req, res) => {
  try {
    const {
      email,
      password,
      server,        // Actual broker server name, e.g. "TradeLocker-Live", "OSP-Server1"
      environment = 'live',  // "live" or "demo" — determines API base URL
      accountId
    } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    if (!server) {
      return res.status(400).json({ error: 'Server name is required (e.g. "TradeLocker-Live")' })
    }
    if (!['live', 'demo'].includes(environment)) {
      return res.status(400).json({ error: 'Environment must be "live" or "demo"' })
    }

    // Authenticate with TradeLocker using the actual server name and environment
    const authResult = await tradelockerService.authenticateTradeLocker(email, password, server, environment)

    // Get all accounts associated with this token
    const accounts = await tradelockerService.getTradeLockerAccounts(authResult.accessToken, environment)

    if (!accounts || accounts.length === 0) {
      return res.status(400).json({ error: 'No accounts found for this TradeLocker account' })
    }

    // If accountId provided, use it; otherwise use first account
    let selectedAccount = accounts[0]
    if (accountId) {
      selectedAccount = accounts.find(acc => acc.accountId === accountId || acc.id === accountId) || accounts[0]
    }

    // Encrypt password for storage
    const encryptedPassword = encrypt(password)

    // Create or update TradeLocker account connection
    const tradelockerAccount = await prisma.tradeLockerAccount.upsert({
      where: { userId: req.userId },
      update: {
        email,
        password: encryptedPassword,
        server,
        environment,
        accountId: selectedAccount.accountId || selectedAccount.id,
        accNum: parseInt(selectedAccount.accNum || selectedAccount.accountNumber || 0, 10),
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken || null,
        tokenExpiresAt: authResult.expiresAt,
        isConnected: true,
        updatedAt: new Date()
      },
      create: {
        userId: req.userId,
        email,
        password: encryptedPassword,
        server,
        environment,
        accountId: selectedAccount.accountId || selectedAccount.id,
        accNum: parseInt(selectedAccount.accNum || selectedAccount.accountNumber || 0, 10),
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken || null,
        tokenExpiresAt: authResult.expiresAt,
        isConnected: true
      }
    })

    res.json({
      success: true,
      account: {
        id: tradelockerAccount.id,
        email: tradelockerAccount.email,
        server: tradelockerAccount.server,
        environment: tradelockerAccount.environment,
        accountId: tradelockerAccount.accountId,
        isConnected: tradelockerAccount.isConnected,
      },
      accounts  // Return all available accounts for selection
    })
  } catch (error) {
    console.error('Connect TradeLocker error:', error)
    res.status(500).json({ error: error.message || 'Failed to connect TradeLocker account' })
  }
})

// Get TradeLocker connection status
router.get('/status', async (req, res) => {
  try {
    const account = await prisma.tradeLockerAccount.findUnique({
      where: { userId: req.userId },
      select: {
        id: true,
        email: true,
        server: true,
        environment: true,
        accountId: true,
        isConnected: true,
        lastSyncedAt: true,
        createdAt: true
      }
    })

    if (!account) {
      return res.json({ connected: false })
    }

    res.json({
      connected: account.isConnected,
      account: {
        email: account.email,
        server: account.server,
        environment: account.environment,
        accountId: account.accountId,
        lastSyncedAt: account.lastSyncedAt
      }
    })
  } catch (error) {
    console.error('Get TradeLocker status error:', error)
    res.status(500).json({ error: 'Failed to get TradeLocker status' })
  }
})

// Disconnect TradeLocker account
router.post('/disconnect', async (req, res) => {
  try {
    await prisma.tradeLockerAccount.update({
      where: { userId: req.userId },
      data: {
        isConnected: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null
      }
    })

    res.json({ success: true, message: 'TradeLocker account disconnected' })
  } catch (error) {
    console.error('Disconnect TradeLocker error:', error)
    res.status(500).json({ error: 'Failed to disconnect TradeLocker account' })
  }
})

// Helper: get a valid access token, refreshing or re-authenticating as needed
async function getValidAccessToken(account) {
  const now = new Date()

  // Token is still valid
  if (account.accessToken && account.tokenExpiresAt && new Date(account.tokenExpiresAt) > now) {
    return account.accessToken
  }

  // Try refresh token first (preferred — no password needed)
  if (account.refreshToken) {
    try {
      const refreshed = await tradelockerService.refreshAccessToken(account.refreshToken, account.environment)
      await prisma.tradeLockerAccount.update({
        where: { userId: account.userId },
        data: {
          accessToken: refreshed.accessToken,
          tokenExpiresAt: refreshed.expiresAt
        }
      })
      return refreshed.accessToken
    } catch (err) {
      console.warn('Refresh token failed, falling back to re-auth:', err.message)
    }
  }

  // Fall back: re-authenticate with stored credentials
  let decryptedPassword
  try {
    decryptedPassword = decrypt(account.password)
  } catch (error) {
    // If decryption fails, the account needs to be reconnected
    throw new Error('Stored credentials are invalid. Please disconnect and reconnect your TradeLocker account.')
  }
  
  const authResult = await tradelockerService.authenticateTradeLocker(
    account.email,
    decryptedPassword,
    account.server,
    account.environment
  )
  await prisma.tradeLockerAccount.update({
    where: { userId: account.userId },
    data: {
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken || account.refreshToken,
      tokenExpiresAt: authResult.expiresAt
    }
  })
  return authResult.accessToken
}

// Sync trades from TradeLocker
router.post('/sync', async (req, res) => {
  try {
    const account = await prisma.tradeLockerAccount.findUnique({
      where: { userId: req.userId }
    })

    if (!account || !account.isConnected) {
      return res.status(400).json({ error: 'TradeLocker account not connected' })
    }

    // Get a valid access token (refresh or re-auth as needed)
    const accessToken = await getValidAccessToken(account)

    // Get account balance (non-fatal — returns zeros if endpoint unavailable)
    const balanceData = await tradelockerService.getAccountBalance(
      accessToken,
      account.accountId,
      account.accNum,
      account.environment
    )
    console.log('TradeLocker balance:', balanceData)

    const settings = await prisma.settings.findUnique({
      where: { userId: req.userId }
    })

    // Update starting balance from TradeLocker if we got a valid balance
    // Use equity if available (includes unrealized PnL), otherwise use balance
    if (balanceData.equity > 0 || balanceData.balance > 0) {
      const newStartingBalance = balanceData.equity > 0 ? balanceData.equity : balanceData.balance
      
      // Only update if settings exist and balance is significantly different
      if (settings) {
        const balanceDiff = Math.abs(newStartingBalance - settings.startingBalance)
        // Update if difference is more than $1 (to avoid tiny updates)
        if (balanceDiff > 1) {
          await prisma.settings.update({
            where: { userId: req.userId },
            data: { startingBalance: newStartingBalance }
          })
          console.log(`Updated starting balance from ${settings.startingBalance} to ${newStartingBalance}`)
        }
      } else {
        // Create settings if they don't exist
        await prisma.settings.create({
          data: {
            userId: req.userId,
            startingBalance: newStartingBalance,
            riskPercent: 2,
            riskReward: 3
          }
        })
        console.log(`Created settings with starting balance: ${newStartingBalance}`)
      }
    }

    // ── Determine incremental sync window ──────────────────────────────────────
    // Run two lean DB queries in parallel:
    //   1. Fetch only tradelockerTradeId values (avoids loading full trade objects)
    //   2. Find the latest already-synced trade's date (used as API startTime)
    const [existingTradeIdRows, latestSyncedTrade] = await Promise.all([
      prisma.trade.findMany({
        where: { userId: req.userId, tradelockerTradeId: { not: null } },
        select: { tradelockerTradeId: true }
      }),
      prisma.trade.findFirst({
        where: { userId: req.userId, tradelockerTradeId: { not: null } },
        orderBy: { date: 'desc' },
        select: { date: true }
      })
    ])

    // Build a fast O(1) lookup set of already-synced IDs
    const existingTradeLockerIds = new Set(
      existingTradeIdRows.map(t => t.tradelockerTradeId)
    )
    console.log(`Already synced: ${existingTradeLockerIds.size} trades in DB`)

    // Use the latest synced trade's close date minus a 1-day buffer as the API
    // startTime so we only ask TradeLocker for trades we haven't seen yet.
    // The 1-day buffer guards against edge cases (e.g. trades that were open
    // at the time of the last sync but closed slightly before it).
    let syncStartTime = null
    if (latestSyncedTrade?.date) {
      const ONE_DAY_MS = 24 * 60 * 60 * 1000
      syncStartTime = String(new Date(latestSyncedTrade.date).getTime() - ONE_DAY_MS)
      console.log(`Incremental sync from: ${new Date(Number(syncStartTime)).toISOString()} (latest trade date − 1 day)`)
    } else {
      console.log('Full sync: no existing trades found, fetching complete history')
    }

    // Get raw orders from TradeLocker (ordersHistory returns individual orders, not positions)
    console.log(`Fetching orders history for accountId=${account.accountId} accNum=${account.accNum}`)
    const rawOrders = await tradelockerService.getClosedPositions(
      accessToken,
      account.accountId,
      account.accNum,
      account.environment,
      syncStartTime  // only fetch trades after this timestamp (null = fetch all)
    )

    // Fetch live FX rates (EUR/USD, GBP/USD) for correct P&L calculation on
    // EUR/GBP-denominated instruments (e.g. DE40.PRO).
    // Non-fatal: falls back to rate=1 if the quotes endpoint is unavailable.
    console.log('Fetching live FX rates for P&L conversion...')
    const fxRates = await tradelockerService.getFXRates(
      accessToken,
      account.accountId,
      account.accNum,
      account.environment
    )
    console.log('FX rates:', fxRates)

    // Fetch all instruments with full metadata (symbol + type).
    // Used by groupPositionOrders for P&L multiplier lookup (FOREX needs type="FOREX").
    const earlyInstrumentMap  = new Map()  // instId → symbol string (for display)
    const earlyInstrumentFull = new Map()  // instId → {symbol, type}
    try {
      const allInstrumentsFull = await tradelockerService.getAllInstrumentsFull(
        accessToken, account.accountId, account.accNum, account.environment
      )
      for (const [k, v] of allInstrumentsFull) {
        earlyInstrumentMap.set(k, v.symbol)
        earlyInstrumentFull.set(k, v)
      }
    } catch (err) {
      console.warn('Early instrument fetch failed (non-fatal):', err.message)
    }

    // Group individual orders into complete closed positions.
    // Each position = 1 opening fill + 1 closing fill linked by positionId [16].
    // Bracket orders (SL/TP stop/limit) are filtered out automatically.
    // Pass instrumentMap + fxRates + instrumentFullMap so the correct multiplier is applied:
    //   NAS100 → ×1 | XAUUSD → ×100 | DE40.PRO → ×100×EURUSD | EURAUD → ×100000×AUDUSD
    const closedPositions = tradelockerService.groupPositionOrders(rawOrders, earlyInstrumentMap, fxRates, earlyInstrumentFull)

    console.log(`\n${'='.repeat(80)}`)
    console.log(`TradeLocker: ${rawOrders.length} raw orders → ${closedPositions.length} closed positions`)
    console.log(`${'='.repeat(80)}\n`)

    if (closedPositions.length > 0) {
      const sample = closedPositions[0]
      console.log('📊 First grouped position:')
      console.log(`  positionId:  ${sample.positionId}`)
      console.log(`  orderId:     ${sample.orderId}`)
      console.log(`  instId:      ${sample.tradableInstrumentId}`)
      console.log(`  side:        ${sample.type}  |  qty: ${sample.qty}  |  type: ${sample.orderType}`)
      console.log(`  entry:       ${sample.openPrice}  →  exit: ${sample.exitPrice}`)
      console.log(`  SL:          ${sample.stopPrice ?? 'N/A'}  |  TP: ${sample.takeProfit ?? 'N/A'}`)
      console.log(`  grossPnL:    ${sample.profit}`)
      const entryDt = sample.openTime ? new Date(Number(sample.openTime)).toISOString() : 'N/A'
      const exitDt  = sample.closeTime ? new Date(Number(sample.closeTime)).toISOString() : 'N/A'
      console.log(`  entry time:  ${entryDt}`)
      console.log(`  exit time:   ${exitDt}`)
    }

    // closedPositions is already sorted oldest-first by groupPositionOrders()
    const sortedPositions = closedPositions

    // Collect unique instrument IDs from grouped positions
    const instrumentIdSet = new Set()
    for (const position of sortedPositions) {
      const instrumentId = position.tradableInstrumentId
      if (instrumentId && String(instrumentId).trim() !== '') {
        instrumentIdSet.add(String(instrumentId))
      }
    }

    // Re-use the already-fetched instrument map (earlyInstrumentMap built before grouping)
    const instrumentSymbolMap = new Map()
    console.log(`Resolving instrument symbols for ${instrumentIdSet.size} unique instruments...`)

    try {
      const instrumentIds = Array.from(instrumentIdSet)
      for (const instrumentId of instrumentIds) {
        // earlyInstrumentMap was populated from getAllInstrumentsFull above
        const symbol = earlyInstrumentMap.get(instrumentId)
        if (symbol) {
          instrumentSymbolMap.set(instrumentId, symbol)
          console.log(`  ✅ ${instrumentId} → ${symbol}`)
        } else {
          console.warn(`  ⚠️  Instrument ${instrumentId} not found in instruments list`)
        }
      }
      console.log(`Resolved ${instrumentSymbolMap.size} instrument symbols out of ${instrumentIds.length} needed`)
    } catch (error) {
      console.warn('Failed to resolve instrument symbols, falling back to individual fetches:', error.message)

      // Fallback: fetch instruments one by one
      const instrumentIds = Array.from(instrumentIdSet)
      for (const instrumentId of instrumentIds) {
        try {
          const instrumentDetails = await tradelockerService.getInstrumentDetails(
            accessToken,
            instrumentId,
            account.accountId,
            account.accNum,
            account.environment
          )
          if (instrumentDetails && instrumentDetails.symbol) {
            instrumentSymbolMap.set(instrumentId, instrumentDetails.symbol)
          }
        } catch (err) {
          console.warn(`Failed to fetch instrument details for ${instrumentId}:`, err.message)
        }
      }
    }

    // Transform and create trades
    const tradesToCreate = []
    let skippedCount = 0
    let currentBalance = settings?.startingBalance || 1000

    for (const position of sortedPositions) {
      // positionId is the primary unique key — set by groupPositionOrders from field [16]
      const positionId = String(position.positionId || '').trim()
      // orderId (closing order) as a secondary unique key for backward compatibility
      const orderId    = String(position.orderId || position.ticket || '').trim()

      const tradeLockerId = positionId || orderId || null

      // Skip if already synced — check both positionId and orderId against the
      // set of previously stored tradelockerTradeId values to handle old records
      // that may have used orderId as the key before positionId was introduced.
      if (positionId && existingTradeLockerIds.has(positionId)) { skippedCount++; continue }
      if (orderId    && existingTradeLockerIds.has(orderId))    { skippedCount++; continue }

      // Instrument symbol lookup
      const instrumentId     = String(position.tradableInstrumentId || '').trim()
      const instrumentSymbol = instrumentId ? instrumentSymbolMap.get(instrumentId) : null

      const transformedTrade = tradelockerService.transformTradeLockerTrade(
        position,
        currentBalance,
        settings || { riskPercent: 2, riskReward: 3 },
        instrumentSymbol
      )

      tradesToCreate.push({
        ...transformedTrade,
        userId: req.userId,
        // Store Position ID as the primary unique key (more stable than Order ID)
        tradelockerTradeId: tradeLockerId || null
      })

      currentBalance = transformedTrade.closeBalance
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`New positions to sync: ${tradesToCreate.length} | Already synced (skipped): ${skippedCount}`)
    console.log(`${'='.repeat(80)}\n`)

    // Process all new trades (no arbitrary cap — deduplication already happened above)
    const limitedTrades = tradesToCreate

    if (limitedTrades.length > 0) {
      console.log('✨ First transformed trade (what gets saved to DB):')
      const ft = limitedTrades[0]
      console.log(`  Date: ${ft.date}  Day: ${ft.day}`)
      console.log(`  P&L: $${ft.pnl}  (${ft.percentGain}%)`)
      console.log(`  Balance: $${ft.openBalance} → $${ft.closeBalance}`)
      console.log(`  R:R: ${ft.rrAchieved}x  Result: ${ft.result}`)
      console.log(`  TradeLocker ID: ${ft.tradelockerTradeId}`)
      console.log(`  Notes: ${ft.notes}`)
    }

    // Create trades in database
    let createdCount = 0
    for (const tradeData of limitedTrades) {
      try {
        await prisma.trade.create({ data: tradeData })
        createdCount++
      } catch (error) {
        // Skip duplicate errors
        if (!error.message.includes('Unique constraint')) {
          console.error('Error creating trade:', error)
        }
      }
    }

    // Update last synced time
    await prisma.tradeLockerAccount.update({
      where: { userId: req.userId },
      data: { lastSyncedAt: new Date() }
    })

    res.json({
      success: true,
      message: createdCount > 0
        ? `${createdCount} new trade${createdCount !== 1 ? 's' : ''} synced from TradeLocker`
        : 'Already up to date — no new trades found',
      tradesCreated: createdCount,
      tradesSkipped: skippedCount,
      accountBalance: balanceData.balance,
      totalFetched: closedPositions.length,
      rawOrders: rawOrders.length
    })
  } catch (error) {
    console.error('Sync TradeLocker error:', error)
    res.status(500).json({ error: error.message || 'Failed to sync trades from TradeLocker' })
  }
})

export default router
