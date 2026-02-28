import React, { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, addMonths, eachMonthOfInterval } from 'date-fns'
import { formatCurrency, parseDateLocal } from '../utils/calculations'
import './Goals.css'

function Goals({ trades, settings }) {
  const [riskPercent, setRiskPercent] = useState(settings.riskPercent || 2)
  const [riskReward, setRiskReward] = useState(settings.riskReward || 3)
  const [tradesPerMonth, setTradesPerMonth] = useState(20)
  const [projectionMonths, setProjectionMonths] = useState(6)

  // Calculate win rate and stats from trade history
  const tradeStats = useMemo(() => {
    if (trades.length === 0) {
      return {
        winRate: 50,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        avgWin: 0,
        avgLoss: 0,
        currentBalance: settings.startingBalance
      }
    }

    const sortedTrades = [...trades].sort((a, b) => {
      const dateCompare = parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return (a.id || '').localeCompare(b.id || '')
    })

    const wins = sortedTrades.filter(t => t.pnl > 0)
    const losses = sortedTrades.filter(t => t.pnl < 0)
    const winRate = sortedTrades.length > 0 ? (wins.length / sortedTrades.length) * 100 : 50
    const currentBalance = sortedTrades.length > 0 
      ? sortedTrades[sortedTrades.length - 1].closeBalance 
      : settings.startingBalance

    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0

    return {
      winRate: Math.round(winRate * 10) / 10,
      totalTrades: sortedTrades.length,
      wins: wins.length,
      losses: losses.length,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      currentBalance: Math.round(currentBalance * 100) / 100
    }
  }, [trades, settings])

  // Calculate compounding projections
  const projections = useMemo(() => {
    const startBalance = tradeStats.currentBalance
    const winRateDecimal = tradeStats.winRate / 100
    const riskDecimal = riskPercent / 100

    const results = []
    let currentBalance = startBalance
    const today = new Date()
    const currentMonthStart = startOfMonth(today)
    
    // Get all months from current month to projection months ahead
    const months = eachMonthOfInterval({
      start: currentMonthStart,
      end: addMonths(currentMonthStart, projectionMonths)
    })

    months.forEach((month, index) => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      const isCurrentMonth = index === 0
      
      // Calculate trades for this month
      const tradesThisMonth = isCurrentMonth 
        ? tradesPerMonth * (today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())
        : tradesPerMonth

      // Simulate compounding for this month
      let monthBalance = currentBalance
      let monthPnL = 0
      const monthlyTrades = []

      for (let i = 0; i < Math.floor(tradesThisMonth); i++) {
        // Calculate expected value per trade based on current balance
        // Expected value = (winRate * risk * riskReward) - ((1 - winRate) * risk)
        // Where risk = balance * riskPercent/100
        // Simplified: balance * riskPercent/100 * (winRate * (riskReward + 1) - 1)
        const expectedValuePerTrade = monthBalance * riskDecimal * (winRateDecimal * (riskReward + 1) - 1)
        
        const tradePnL = expectedValuePerTrade
        monthBalance += tradePnL
        monthPnL += tradePnL
        monthlyTrades.push({
          balance: Math.round(monthBalance * 100) / 100,
          pnl: Math.round(tradePnL * 100) / 100
        })
      }

      const monthStartBalance = currentBalance
      const monthEndBalance = Math.round(monthBalance * 100) / 100
      const monthReturn = monthEndBalance - monthStartBalance
      const monthReturnPercent = monthStartBalance > 0 ? (monthReturn / monthStartBalance) * 100 : 0

      results.push({
        month: format(month, 'MMM yyyy'),
        monthStart: monthStart,
        monthEnd: monthEnd,
        isCurrentMonth,
        startBalance: Math.round(monthStartBalance * 100) / 100,
        endBalance: monthEndBalance,
        return: Math.round(monthReturn * 100) / 100,
        returnPercent: Math.round(monthReturnPercent * 100) / 100,
        trades: Math.floor(tradesThisMonth)
      })

      currentBalance = monthEndBalance
    })

    return results
  }, [tradeStats, riskPercent, riskReward, tradesPerMonth, projectionMonths, trades])

  const totalProjection = useMemo(() => {
    if (projections.length === 0) return null
    const last = projections[projections.length - 1]
    const first = projections[0]
    return {
      startBalance: first.startBalance,
      endBalance: last.endBalance,
      totalReturn: last.endBalance - first.startBalance,
      totalReturnPercent: first.startBalance > 0 
        ? ((last.endBalance - first.startBalance) / first.startBalance) * 100 
        : 0
    }
  }, [projections])

  return (
    <div className="goals-container">
      <div className="goals-header">
        <div>
          <h1 className="goals-title">
            <span className="material-icons">flag</span>
            Goals & Projections
          </h1>
          <p className="goals-subtitle">Compound your trading performance with realistic projections</p>
        </div>
      </div>

      {/* Current Stats */}
      <div className="goals-stats-section">
        <h2 className="section-title">Your Trading Performance</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">account_balance_wallet</span>
              </span>
              <span className="stat-label">Current Balance</span>
            </div>
            <div className="stat-value-large">{formatCurrency(tradeStats.currentBalance)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">percent</span>
              </span>
              <span className="stat-label">Win Rate</span>
            </div>
            <div className="stat-value">{tradeStats.winRate.toFixed(1)}%</div>
            <div className="stat-meta">
              {tradeStats.wins}W / {tradeStats.losses}L
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">bar_chart</span>
              </span>
              <span className="stat-label">Total Trades</span>
            </div>
            <div className="stat-value">{tradeStats.totalTrades}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">arrow_upward</span>
              </span>
              <span className="stat-label">Avg Win</span>
            </div>
            <div className="stat-value positive">{formatCurrency(tradeStats.avgWin)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">arrow_downward</span>
              </span>
              <span className="stat-label">Avg Loss</span>
            </div>
            <div className="stat-value negative">{formatCurrency(tradeStats.avgLoss)}</div>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="goals-config-section">
        <h2 className="section-title">Configure Your Trading Parameters</h2>
        <div className="config-grid">
          <div className="config-item">
            <label htmlFor="riskPercent">
              <span className="material-icons">warning</span>
              Risk Per Trade (%)
            </label>
            <div className="config-input-wrapper">
              <input
                id="riskPercent"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 2)}
                className="config-input"
              />
              <span className="config-unit">%</span>
            </div>
            <p className="config-hint">Percentage of balance risked per trade</p>
          </div>

          <div className="config-item">
            <label htmlFor="riskReward">
              <span className="material-icons">trending_up</span>
              Risk:Reward Ratio
            </label>
            <div className="config-input-wrapper">
              <input
                id="riskReward"
                type="number"
                min="0.5"
                max="10"
                step="0.1"
                value={riskReward}
                onChange={(e) => setRiskReward(parseFloat(e.target.value) || 3)}
                className="config-input"
              />
              <span className="config-unit">:1</span>
            </div>
            <p className="config-hint">Reward multiplier for each unit of risk</p>
          </div>

          <div className="config-item">
            <label htmlFor="tradesPerMonth">
              <span className="material-icons">calendar_month</span>
              Trades Per Month
            </label>
            <div className="config-input-wrapper">
              <input
                id="tradesPerMonth"
                type="number"
                min="1"
                max="100"
                step="1"
                value={tradesPerMonth}
                onChange={(e) => setTradesPerMonth(parseInt(e.target.value) || 20)}
                className="config-input"
              />
            </div>
            <p className="config-hint">Expected number of trades per month</p>
          </div>

          <div className="config-item">
            <label htmlFor="projectionMonths">
              <span className="material-icons">schedule</span>
              Projection Period
            </label>
            <div className="config-input-wrapper">
              <input
                id="projectionMonths"
                type="number"
                min="1"
                max="24"
                step="1"
                value={projectionMonths}
                onChange={(e) => setProjectionMonths(parseInt(e.target.value) || 6)}
                className="config-input"
              />
              <span className="config-unit">months</span>
            </div>
            <p className="config-hint">Number of months to project ahead</p>
          </div>
        </div>
      </div>

      {/* Projections Summary */}
      {totalProjection && (
        <div className="projection-summary">
          <div className="summary-card primary">
            <div className="summary-label">Projected Balance</div>
            <div className="summary-value-large">{formatCurrency(totalProjection.endBalance)}</div>
            <div className="summary-change">
              <span className={totalProjection.totalReturnPercent >= 0 ? 'positive' : 'negative'}>
                {totalProjection.totalReturnPercent >= 0 ? '+' : ''}
                {totalProjection.totalReturnPercent.toFixed(2)}%
              </span>
              <span className="summary-change-label">
                over {projectionMonths} month{projectionMonths !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Return</div>
            <div className={`summary-value ${totalProjection.totalReturn >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(totalProjection.totalReturn)}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Projections */}
      <div className="projections-section">
        <h2 className="section-title">Monthly Projections</h2>
        <div className="projections-table-wrapper">
          <table className="projections-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Start Balance</th>
                <th>Trades</th>
                <th>Return</th>
                <th>Return %</th>
                <th>End Balance</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((projection, index) => (
                <tr key={index} className={projection.isCurrentMonth ? 'current-month' : ''}>
                  <td>
                    <div className="month-cell">
                      {projection.month}
                      {projection.isCurrentMonth && (
                        <span className="current-badge">Current</span>
                      )}
                    </div>
                  </td>
                  <td>{formatCurrency(projection.startBalance)}</td>
                  <td>{projection.trades}</td>
                  <td>
                    <span className={projection.return >= 0 ? 'positive' : 'negative'}>
                      {projection.return >= 0 ? '+' : ''}{formatCurrency(projection.return)}
                    </span>
                  </td>
                  <td>
                    <span className={projection.returnPercent >= 0 ? 'positive' : 'negative'}>
                      {projection.returnPercent >= 0 ? '+' : ''}{projection.returnPercent.toFixed(2)}%
                    </span>
                  </td>
                  <td className="end-balance-cell">
                    <strong>{formatCurrency(projection.endBalance)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="info-box">
        <div className="info-icon">
          <span className="material-icons">info</span>
        </div>
        <div className="info-content">
          <h3>How Projections Work</h3>
          <p>
            Projections are calculated using your historical win rate ({tradeStats.winRate.toFixed(1)}%) 
            and the configured risk parameters. Each trade assumes you risk {riskPercent}% of your balance 
            with a {riskReward}:1 risk:reward ratio. The compounding effect is applied monthly, 
            meaning your balance grows (or shrinks) based on the expected value of each trade.
          </p>
          <p>
            <strong>Note:</strong> These are projections based on statistical expectations. Actual results 
            will vary based on market conditions and your trading performance.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Goals
