import React, { useState, useMemo, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, addMonths, eachMonthOfInterval } from 'date-fns'
import { formatCurrency, parseDateLocal } from '../utils/calculations'
import './Goals.css'

function Goals({
  trades,
  settings,
  simulationMode,
  onSimulationModeChange,
  simBalance,
  onSimBalanceChange,
  simWinRate,
  onSimWinRateChange
}) {
  // Use string state for all inputs so browser min/max constraints don't reset
  // values mid-typing (e.g. typing "700" when max=100 would return "" and reset)
  const [riskPercentInput, setRiskPercentInput] = useState(String(settings.riskPercent || 2))
  const [riskRewardInput, setRiskRewardInput] = useState(String(settings.riskReward || 3))
  const [tradesPerMonthInput, setTradesPerMonthInput] = useState('20')
  const [projectionMonthsInput, setProjectionMonthsInput] = useState('6')
  const [simBalanceInput, setSimBalanceInput] = useState(String(simBalance))
  const [simWinRateInput, setSimWinRateInput] = useState(String(simWinRate))

  // Parsed numeric values used only for computation — never written back to inputs
  const riskPercent = parseFloat(riskPercentInput) || 0
  const riskReward = parseFloat(riskRewardInput) || 0
  const tradesPerMonth = parseInt(tradesPerMonthInput) || 0
  const projectionMonths = parseInt(projectionMonthsInput) || 0

  // Keep sim inputs in sync only when the Settings page changes the values externally
  useEffect(() => { setSimBalanceInput(String(simBalance)) }, [simBalance])
  useEffect(() => { setSimWinRateInput(String(simWinRate)) }, [simWinRate])

  // Calculate win rate and stats from real trade history
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

  // Effective stats: real or simulated depending on mode
  const effectiveBalance = simulationMode ? (parseFloat(simBalance) || 0) : tradeStats.currentBalance
  const effectiveWinRate = simulationMode ? (parseFloat(simWinRate) || 0) : tradeStats.winRate

  // Calculate compounding projections
  const projections = useMemo(() => {
    const startBalance = effectiveBalance
    const winRateDecimal = effectiveWinRate / 100
    const riskDecimal = riskPercent / 100

    const results = []
    let currentBalance = startBalance
    const today = new Date()
    const currentMonthStart = startOfMonth(today)

    const months = eachMonthOfInterval({
      start: currentMonthStart,
      end: addMonths(currentMonthStart, projectionMonths)
    })

    months.forEach((month, index) => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      const isCurrentMonth = index === 0

      const tradesThisMonth = isCurrentMonth
        ? tradesPerMonth * (today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())
        : tradesPerMonth

      let monthBalance = currentBalance
      let monthPnL = 0

      for (let i = 0; i < Math.floor(tradesThisMonth); i++) {
        const expectedValuePerTrade = monthBalance * riskDecimal * (winRateDecimal * (riskReward + 1) - 1)
        const tradePnL = expectedValuePerTrade
        monthBalance += tradePnL
        monthPnL += tradePnL
      }

      const monthStartBalance = currentBalance
      const monthEndBalance = Math.round(monthBalance * 100) / 100
      const monthReturn = monthEndBalance - monthStartBalance
      const monthReturnPercent = monthStartBalance > 0 ? (monthReturn / monthStartBalance) * 100 : 0

      results.push({
        month: format(month, 'MMM yyyy'),
        monthStart,
        monthEnd,
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
  }, [effectiveBalance, effectiveWinRate, riskPercent, riskReward, tradesPerMonth, projectionMonths])

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

        {/* Real / Simulate mode toggle */}
        <div className="mode-toggle-wrapper">
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-toggle-btn${!simulationMode ? ' active' : ''}`}
              onClick={() => onSimulationModeChange(false)}
            >
              <span className="material-icons">show_chart</span>
              Real
            </button>
            <button
              type="button"
              className={`mode-toggle-btn simulate${simulationMode ? ' active' : ''}`}
              onClick={() => onSimulationModeChange(true)}
            >
              <span className="material-icons">science</span>
              Simulate
            </button>
          </div>
          {simulationMode && (
            <span className="sim-badge">
              <span className="material-icons">science</span>
              Simulation Mode
            </span>
          )}
        </div>
      </div>

      {/* Simulation Overrides — only visible in Simulate mode */}
      {simulationMode && (
        <div className="sim-overrides-card">
          <div className="sim-overrides-header">
            <span className="material-icons">tune</span>
            <div>
              <h3>Simulation Parameters</h3>
              <p>Override real account data with custom values for "what-if" projections</p>
            </div>
          </div>
          <div className="sim-overrides-grid">
            <div className="sim-override-item">
              <label htmlFor="simBalance">
                <span className="material-icons">account_balance_wallet</span>
                Starting Balance ($)
              </label>
              <div className="config-input-wrapper">
                <span className="config-prefix">$</span>
                <input
                  id="simBalance"
                  type="number"
                  step="100"
                  value={simBalanceInput}
                  onChange={(e) => {
                    setSimBalanceInput(e.target.value)
                    const parsed = parseFloat(e.target.value)
                    if (!isNaN(parsed)) onSimBalanceChange(parsed)
                  }}
                  className="config-input with-prefix"
                />
              </div>
              <p className="config-hint">Custom balance instead of your real account balance</p>
            </div>

            <div className="sim-override-item">
              <label htmlFor="simWinRate">
                <span className="material-icons">percent</span>
                Win Rate (%)
              </label>
              <div className="config-input-wrapper">
                <input
                  id="simWinRate"
                  type="number"
                  step="0.1"
                  value={simWinRateInput}
                  onChange={(e) => {
                    setSimWinRateInput(e.target.value)
                    const parsed = parseFloat(e.target.value)
                    if (!isNaN(parsed)) onSimWinRateChange(parsed)
                  }}
                  className="config-input"
                />
                <span className="config-unit">%</span>
              </div>
              <p className="config-hint">Custom win rate instead of your historical win rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Stats */}
      <div className="goals-stats-section">
        <h2 className="section-title">
          {simulationMode ? 'Simulation Parameters' : 'Your Trading Performance'}
        </h2>
        <div className="stats-grid">
          <div className={`stat-card${simulationMode ? ' simulated' : ''}`}>
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">account_balance_wallet</span>
              </span>
              <span className="stat-label">
                {simulationMode ? 'Simulated Balance' : 'Current Balance'}
              </span>
              {simulationMode && <span className="stat-sim-badge">SIM</span>}
            </div>
            <div className="stat-value-large">{formatCurrency(effectiveBalance)}</div>
            {simulationMode && (
              <div className="stat-real-value">
                Real: {formatCurrency(tradeStats.currentBalance)}
              </div>
            )}
          </div>

          <div className={`stat-card${simulationMode ? ' simulated' : ''}`}>
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">percent</span>
              </span>
              <span className="stat-label">
                {simulationMode ? 'Simulated Win Rate' : 'Win Rate'}
              </span>
              {simulationMode && <span className="stat-sim-badge">SIM</span>}
            </div>
            <div className="stat-value">{effectiveWinRate.toFixed(1)}%</div>
            {!simulationMode && (
              <div className="stat-meta">
                {tradeStats.wins}W / {tradeStats.losses}L
              </div>
            )}
            {simulationMode && (
              <div className="stat-real-value">
                Real: {tradeStats.winRate.toFixed(1)}% ({tradeStats.wins}W / {tradeStats.losses}L)
              </div>
            )}
          </div>

          {!simulationMode && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Configuration */}
      <div className="goals-config-section">
        <h2 className="section-title">Configure Your Trading Parameters</h2>
        <form onSubmit={(e) => e.preventDefault()} noValidate>
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
                step="0.1"
                value={riskPercentInput}
                onChange={(e) => setRiskPercentInput(e.target.value)}
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
                step="0.1"
                value={riskRewardInput}
                onChange={(e) => setRiskRewardInput(e.target.value)}
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
                step="1"
                value={tradesPerMonthInput}
                onChange={(e) => setTradesPerMonthInput(e.target.value)}
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
                step="1"
                value={projectionMonthsInput}
                onChange={(e) => setProjectionMonthsInput(e.target.value)}
                className="config-input"
              />
              <span className="config-unit">months</span>
            </div>
            <p className="config-hint">Number of months to project ahead</p>
          </div>
        </div>
        </form>
      </div>

      {/* Projections Summary */}
      {totalProjection && (
        <div className="projection-summary">
          <div className="summary-card primary">
            <div className="summary-label">
              Projected Balance
              {simulationMode && <span className="summary-sim-tag">Simulated</span>}
            </div>
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
            Projections are calculated using {simulationMode ? `a simulated win rate of ${effectiveWinRate.toFixed(1)}%` : `your historical win rate (${tradeStats.winRate.toFixed(1)}%)`}{' '}
            and the configured risk parameters. Each trade assumes you risk {riskPercent}% of your balance
            with a {riskReward}:1 risk:reward ratio. The compounding effect is applied monthly,
            meaning your balance grows (or shrinks) based on the expected value of each trade.
          </p>
          {simulationMode && (
            <p className="sim-info-note">
              <span className="material-icons">science</span>
              <strong>Simulation mode is active.</strong> Projections use a simulated starting balance of{' '}
              {formatCurrency(effectiveBalance)} and a {effectiveWinRate.toFixed(1)}% win rate instead of your real account data.
            </p>
          )}
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
