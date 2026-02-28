import { format, startOfDay, isSameDay } from 'date-fns'

// Parse a YYYY-MM-DD date string as LOCAL midnight (parseISO treats date-only
// strings as UTC midnight, which shows the wrong day in US timezones)
export const parseDateLocal = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return new Date(NaN)
  // Standard YYYY-MM-DD → append local time to avoid UTC interpretation
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date(dateString + 'T00:00:00')
  // Handle ISO date strings (e.g., "2024-02-27T00:00:00.000Z") by extracting date part
  const isoMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return new Date(isoMatch[1] + 'T00:00:00')
  // Fallback for any other string format
  return new Date(dateString)
}

export const calculateTradeMetrics = (pnl, openBalance, riskPercent, riskReward) => {
  const riskDollar = (openBalance * riskPercent) / 100
  const targetDollar = riskDollar * riskReward
  const percentGain = openBalance > 0 ? (pnl / openBalance) * 100 : 0
  const closeBalance = openBalance + pnl
  const rrAchieved = riskDollar > 0 ? pnl / riskDollar : 0
  const targetHit = pnl >= targetDollar && riskDollar > 0

  return {
    riskDollar: Math.round(riskDollar * 100) / 100,
    targetDollar: Math.round(targetDollar * 100) / 100,
    percentGain: Math.round(percentGain * 100) / 100,
    closeBalance: Math.round(closeBalance * 100) / 100,
    rrAchieved: Math.round(rrAchieved * 100) / 100,
    targetHit,
    cumulativePnL: pnl // This will be calculated across all trades in the component
  }
}

export const calculateCumulativePnL = (trades) => {
  let cumulative = 0
  return trades.map(trade => {
    cumulative += trade.pnl
    return { ...trade, cumulativePnL: Math.round(cumulative * 100) / 100 }
  })
}

// Recalculate all balances for trades in chronological order
export const recalculateBalances = (trades, startingBalance) => {
  if (trades.length === 0) return []
  
  // Sort trades by date and time (if multiple on same day, keep original order)
  const sortedTrades = [...trades].sort((a, b) => {
    const dateCompare = parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime()
    if (dateCompare !== 0) return dateCompare
    // If same date, use ID to maintain order
    return (a.id || '').localeCompare(b.id || '')
  })
  
  let currentBalance = startingBalance
  const recalculatedTrades = sortedTrades.map(trade => {
    const openBalance = currentBalance
    const closeBalance = openBalance + trade.pnl
    currentBalance = closeBalance
    
    return {
      ...trade,
      openBalance: Math.round(openBalance * 100) / 100,
      closeBalance: Math.round(closeBalance * 100) / 100
    }
  })
  
  return recalculatedTrades
}

export const getDayName = (dateString) => {
  return format(parseDateLocal(dateString), 'EEE')
}

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export const getResultMessage = (targetHit, pnl) => {
  if (targetHit && pnl > 0) {
    return 'Target Achieved'
  } else if (pnl > 0) {
    return 'Win'
  } else if (pnl < 0) {
    return 'Loss'
  }
  return 'Breakeven'
}

export const getResultIcon = (targetHit, pnl) => {
  if (targetHit && pnl > 0) {
    return 'celebration'
  } else if (pnl > 0) {
    return 'check_circle'
  } else if (pnl < 0) {
    return 'cancel'
  }
  return 'remove'
}
