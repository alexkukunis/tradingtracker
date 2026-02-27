import { format, parseISO, startOfDay, isSameDay } from 'date-fns'

export const calculateTradeMetrics = (pnl, openBalance, riskPercent, riskReward) => {
  const riskDollar = (openBalance * riskPercent) / 100
  const targetDollar = riskDollar * riskReward
  const percentGainLoss = (pnl / openBalance) * 100
  const closeBalance = openBalance + pnl
  const rrAchieved = riskDollar > 0 ? pnl / riskDollar : 0
  const targetHit = pnl >= targetDollar
  const cumulativePnL = pnl // This will be calculated across all trades in the component

  return {
    riskDollar: Math.round(riskDollar * 100) / 100,
    targetDollar: Math.round(targetDollar * 100) / 100,
    percentGainLoss: Math.round(percentGainLoss * 100) / 100,
    closeBalance: Math.round(closeBalance * 100) / 100,
    rrAchieved: Math.round(rrAchieved * 100) / 100,
    targetHit,
    cumulativePnL
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
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
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
  const date = parseISO(dateString)
  return format(date, 'EEE')
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
