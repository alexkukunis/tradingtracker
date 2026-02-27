import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { formatCurrency } from '../utils/calculations'
import './EquityCurve.css'

function EquityCurve({ trades, settings }) {
  const chartData = useMemo(() => {
    if (trades.length === 0) {
      return [{ date: 'Start', balance: settings.startingBalance, cumulativePnL: 0 }]
    }

    const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date))
    
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
      
      data.push({
        date: format(parseISO(trade.date), 'MMM d'),
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
      const dateCompare = new Date(a.date) - new Date(b.date)
      if (dateCompare !== 0) return dateCompare
      return (a.id || '').localeCompare(b.id || '')
    })
    
    const currentBalance = sortedTrades[sortedTrades.length - 1].closeBalance
    const totalReturn = currentBalance - settings.startingBalance
    const totalReturnPercent = (totalReturn / settings.startingBalance) * 100

    // Calculate max drawdown - track running balance and peak
    // Start with starting balance as initial peak
    let peak = settings.startingBalance
    let maxDrawdown = 0
    let maxDrawdownPercent = 0
    
    // Check drawdown from starting balance first (in case first trade is a loss)
    sortedTrades.forEach(trade => {
      const balance = trade.closeBalance
      
      // Update peak if we've reached a new high
      if (balance > peak) {
        peak = balance
      }
      
      // Calculate drawdown from current peak
      const drawdown = peak - balance
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0
      
      // Track maximum drawdown (only if positive, meaning we're below the peak)
      if (drawdown > 0 && drawdown > maxDrawdown) {
        maxDrawdown = drawdown
        maxDrawdownPercent = drawdownPercent
      }
    })
    
    // Round the values
    maxDrawdown = Math.round(maxDrawdown * 100) / 100
    maxDrawdownPercent = Math.round(maxDrawdownPercent * 100) / 100

    return {
      currentBalance: Math.round(currentBalance * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100
    }
  }, [trades, settings])

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{data.date}</p>
          <p className="tooltip-value">
            Balance: <span style={{ color: '#00d4ff' }}>{formatCurrency(data.balance)}</span>
          </p>
          <p className="tooltip-value">
            P&L: <span style={{ color: data.pnl >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(data.pnl)}
            </span>
          </p>
          <p className="tooltip-value">
            Cum. P&L: <span style={{ color: data.cumulativePnL >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(data.cumulativePnL)}
            </span>
          </p>
        </div>
      )
    }
    return null
  }

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
        <div className="chart-card">
          <h3>Account Balance Over Time</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="date" 
                stroke="#94a3b8"
                style={{ fontSize: '0.85rem' }}
              />
              <YAxis 
                stroke="#94a3b8"
                style={{ fontSize: '0.85rem' }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="linear"
                dataKey="balance"
                stroke="#00d4ff"
                strokeWidth={3}
                dot={{ fill: '#00d4ff', r: 4, strokeWidth: 2, stroke: '#0ea5e9' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#0ea5e9' }}
                name="Account Balance"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Cumulative P&L</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="date" 
                stroke="#94a3b8"
                style={{ fontSize: '0.85rem' }}
              />
              <YAxis 
                stroke="#94a3b8"
                style={{ fontSize: '0.85rem' }}
                tickFormatter={(value) => `$${value >= 0 ? '+' : ''}${value.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="linear"
                dataKey="cumulativePnL"
                stroke="#7c3aed"
                strokeWidth={3}
                dot={{ fill: '#7c3aed', r: 4, strokeWidth: 2, stroke: '#6d28d9' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#6d28d9' }}
                name="Cumulative P&L"
                connectNulls={false}
              />
              <Line
                type="linear"
                dataKey="pnl"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#10b981', r: 3, strokeWidth: 1, stroke: '#059669' }}
                activeDot={{ r: 5 }}
                name="Daily P&L"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default EquityCurve
