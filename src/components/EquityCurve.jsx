import React, { useMemo } from 'react'
import { format } from 'date-fns'
import { formatCurrency, parseDateLocal } from '../utils/calculations'
import CumulativePnLChart from './CumulativePnLChart'
import './EquityCurve.css'

function EquityCurve({ trades, settings }) {
  const chartData = useMemo(() => {
    if (trades.length === 0) {
      return [{ date: 'Start', balance: settings.startingBalance, cumulativePnL: 0 }]
    }

    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return (a.id || '').localeCompare(b.id || '')
    })
    
    let cumulativeBalance = settings.startingBalance
    let cumulativePnL = 0

    const data = [
      {
        date: 'Start',
        balance: settings.startingBalance,
        cumulativePnL: 0,
        pnl: 0
      }
    ]

    sortedTrades.forEach(trade => {
      cumulativeBalance = trade.closeBalance
      cumulativePnL += trade.pnl
      const tradeDate = parseDateLocal(trade.date)
      
      data.push({
        date: format(tradeDate, 'MMM d'),
        dateISO: format(tradeDate, 'yyyy-MM-dd'),
        balance: Math.round(cumulativeBalance * 100) / 100,
        cumulativePnL: Math.round(cumulativePnL * 100) / 100,
        pnl: trade.pnl
      })
    })

    return data
  }, [trades, settings])

  const stats = useMemo(() => {
    if (trades.length === 0) {
      return {
        currentBalance: settings.startingBalance,
        totalReturn: 0,
        totalReturnPercent: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0
      }
    }

    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return (a.id || '').localeCompare(b.id || '')
    })
    
    const currentBalance = sortedTrades[sortedTrades.length - 1].closeBalance
    const totalReturn = currentBalance - settings.startingBalance
    const totalReturnPercent = (totalReturn / settings.startingBalance) * 100

    // Calculate max drawdown - track running balance and peak
    let peak = settings.startingBalance
    let maxDrawdown = 0
    let maxDrawdownPercent = 0
    
    sortedTrades.forEach(trade => {
      const balance = trade.closeBalance
      if (balance > peak) peak = balance
      const drawdown = peak - balance
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0
      if (drawdown > 0 && drawdown > maxDrawdown) {
        maxDrawdown = drawdown
        maxDrawdownPercent = drawdownPercent
      }
    })
    
    return {
      currentBalance: Math.round(currentBalance * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100
    }
  }, [trades, settings])

  return (
    <div className="equity-container">
      <div className="equity-header">
        <h2>
          <span className="material-icons">show_chart</span>
          Equity Curve
        </h2>
        <p className="equity-subtitle">Track your account balance over time</p>
      </div>

      <div className="equity-stats">
        <div className="stat-card">
          <span className="stat-label">Current Balance</span>
          <span className="stat-value">{formatCurrency(stats.currentBalance)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Return</span>
          <span className={`stat-value ${stats.totalReturn >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(stats.totalReturn)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Return %</span>
          <span className={`stat-value ${stats.totalReturnPercent >= 0 ? 'positive' : 'negative'}`}>
            {stats.totalReturnPercent.toFixed(2)}%
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Max Drawdown</span>
          <span className="stat-value negative">
            {formatCurrency(stats.maxDrawdown)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Max Drawdown %</span>
          <span className="stat-value negative">
            {stats.maxDrawdownPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="chart-container">
        <CumulativePnLChart
          data={chartData}
          title="Cumulative P&L Account Balance Over Time"
          startingBalance={settings.startingBalance}
        />
      </div>
    </div>
  )
}

export default EquityCurve
