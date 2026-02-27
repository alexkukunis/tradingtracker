import React, { useState, useEffect } from 'react'
import { format, parseISO, isSameDay } from 'date-fns'
import { calculateTradeMetrics, getDayName, formatCurrency, getResultMessage, getResultIcon } from '../utils/calculations'
import Modal from './Modal'
import './Dashboard.css'

function Dashboard({ settings, trades, onAddTrade, onUpdateTrade }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null)
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    pnl: '',
    notes: ''
  })

  const openModal = (trade = null) => {
    if (trade) {
      setEditingTrade(trade)
      setFormData({
        date: trade.date,
        pnl: trade.pnl.toString(),
        notes: trade.notes || ''
      })
    } else {
      setEditingTrade(null)
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        pnl: '',
        notes: ''
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTrade(null)
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      pnl: '',
      notes: ''
    })
  }

  const getOpenBalance = (selectedDate, selectedTime = null) => {
    if (trades.length === 0) return settings.startingBalance
    
    const selectedDateObj = parseISO(selectedDate)
    
    // Get all trades before this date/time
    const sortedTrades = [...trades]
      .filter(t => {
        const tradeDate = new Date(t.date)
        if (tradeDate < selectedDateObj) return true
        if (tradeDate.getTime() === selectedDateObj.getTime() && selectedTime && t.id && t.id < selectedTime) return true
        return false
      })
      .sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
        if (dateCompare !== 0) return dateCompare
        return (a.id || '').localeCompare(b.id || '')
      })
    
    if (sortedTrades.length === 0) return settings.startingBalance
    
    const lastTrade = sortedTrades[sortedTrades.length - 1]
    return lastTrade.closeBalance || settings.startingBalance
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const pnl = parseFloat(formData.pnl) || 0
    const tradeId = editingTrade?.id || `${formData.date}-${Date.now()}-${Math.random()}`
    const openBalance = getOpenBalance(formData.date, tradeId)
    
    const metrics = calculateTradeMetrics(
      pnl,
      openBalance,
      settings.riskPercent,
      settings.riskReward
    )

    const tradeData = {
      id: tradeId,
      date: formData.date,
      day: getDayName(formData.date),
      pnl: Math.round(pnl * 100) / 100,
      openBalance: Math.round(openBalance * 100) / 100,
      ...metrics,
      notes: formData.notes,
      result: getResultMessage(metrics.targetHit, pnl)
    }

    if (editingTrade) {
      onUpdateTrade(editingTrade.id, tradeData)
    } else {
      onAddTrade(tradeData)
    }

    closeModal()
  }

  const calculateStats = () => {
    if (trades.length === 0) {
      return {
        totalPnL: 0,
        totalPercent: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        bestDay: null,
        worstDay: null,
        currentBalance: settings.startingBalance,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        profitFactor: 0
      }
    }

    const wins = trades.filter(t => t.pnl > 0)
    const losses = trades.filter(t => t.pnl < 0)
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0)
    const startingBalance = settings.startingBalance
    const currentBalance = trades.length > 0 
      ? trades[trades.length - 1].closeBalance 
      : startingBalance
    const totalPercent = ((currentBalance - startingBalance) / startingBalance) * 100

    const bestDay = [...trades].sort((a, b) => b.pnl - a.pnl)[0]
    const worstDay = [...trades].sort((a, b) => a.pnl - b.pnl)[0]

    const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0)
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0)

    return {
      totalPnL,
      totalPercent,
      winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      avgWin: wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0,
      avgLoss: losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0,
      bestDay,
      worstDay,
      currentBalance,
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      profitFactor
    }
  }

  const stats = calculateStats()
  const openBalance = getOpenBalance(formData.date)

  // Get today's trades
  const todayTrades = trades.filter(t => isSameDay(parseISO(t.date), new Date()))

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Track your trading performance</p>
        </div>
        <button className="add-trade-button" onClick={() => openModal()}>
          <span className="material-icons">add</span>
          Add Trade
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-card-header">
            <span className="stat-icon">
              <span className="material-icons">account_balance_wallet</span>
            </span>
            <span className="stat-label">Current Balance</span>
          </div>
          <div className="stat-value-large">{formatCurrency(stats.currentBalance)}</div>
          <div className="stat-change">
            <span className={stats.totalPercent >= 0 ? 'positive' : 'negative'}>
              {stats.totalPercent >= 0 ? '+' : ''}{stats.totalPercent.toFixed(2)}%
            </span>
            <span className="stat-change-label">from start</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon">
              <span className="material-icons">trending_up</span>
            </span>
            <span className="stat-label">Total P&L</span>
          </div>
          <div className={`stat-value ${stats.totalPnL >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(stats.totalPnL)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon">
              <span className="material-icons">percent</span>
            </span>
            <span className="stat-label">Win Rate</span>
          </div>
          <div className="stat-value">{stats.winRate.toFixed(1)}%</div>
          <div className="stat-meta">
            {stats.wins}W / {stats.losses}L
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon">
              <span className="material-icons">bar_chart</span>
            </span>
            <span className="stat-label">Total Trades</span>
          </div>
          <div className="stat-value">{stats.totalTrades}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon">
              <span className="material-icons">arrow_upward</span>
            </span>
            <span className="stat-label">Avg Win</span>
          </div>
          <div className="stat-value positive">{formatCurrency(stats.avgWin)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-icon">
              <span className="material-icons">arrow_downward</span>
            </span>
            <span className="stat-label">Avg Loss</span>
          </div>
          <div className="stat-value negative">{formatCurrency(stats.avgLoss)}</div>
        </div>

        {stats.bestDay && (
          <div className="stat-card highlight">
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">emoji_events</span>
              </span>
              <span className="stat-label">Best Day</span>
            </div>
            <div className="stat-value positive">{formatCurrency(stats.bestDay.pnl)}</div>
            <div className="stat-meta">{format(parseISO(stats.bestDay.date), 'MMM d, yyyy')}</div>
          </div>
        )}

        {stats.worstDay && stats.worstDay.pnl < 0 && (
          <div className="stat-card highlight">
            <div className="stat-card-header">
              <span className="stat-icon">
                <span className="material-icons">trending_down</span>
              </span>
              <span className="stat-label">Worst Day</span>
            </div>
            <div className="stat-value negative">{formatCurrency(stats.worstDay.pnl)}</div>
            <div className="stat-meta">{format(parseISO(stats.worstDay.date), 'MMM d, yyyy')}</div>
          </div>
        )}
      </div>

      {todayTrades.length > 0 && (
        <div className="today-trades">
          <h2 className="section-title">Today's Trades ({todayTrades.length})</h2>
          <div className="trades-list">
            {todayTrades.map((trade, idx) => (
              <div key={trade.id || idx} className="trade-card" onClick={() => openModal(trade)}>
                <div className="trade-card-header">
                  <div className="trade-date">
                    <span className="material-icons">schedule</span>
                    Trade #{idx + 1}
                  </div>
                  <span className={`trade-result-badge ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                    <span className="material-icons">{getResultIcon(trade.targetHit, trade.pnl)}</span>
                    {trade.result}
                  </span>
                </div>
                <div className="trade-card-body">
                  <div className="trade-pnl-large">
                    <span className={trade.pnl >= 0 ? 'positive' : 'negative'}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </span>
                  </div>
                  <div className="trade-metrics-row">
                    <div className="trade-metric">
                      <span className="metric-label">%</span>
                      <span className={`metric-value ${trade.percentGainLoss >= 0 ? 'positive' : 'negative'}`}>
                        {trade.percentGainLoss.toFixed(2)}%
                      </span>
                    </div>
                    <div className="trade-metric">
                      <span className="metric-label">R:R</span>
                      <span className="metric-value">{trade.rrAchieved.toFixed(2)}x</span>
                    </div>
                    <div className="trade-metric">
                      <span className="metric-label">Balance</span>
                      <span className="metric-value">{formatCurrency(trade.closeBalance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trades.length > 0 && (
        <div className="recent-trades">
          <h2 className="section-title">Recent Trades</h2>
          <div className="trades-list">
            {[...trades].sort((a, b) => {
              const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
              if (dateCompare !== 0) return dateCompare
              return (b.id || '').localeCompare(a.id || '')
            }).slice(0, 5).map((trade, idx) => (
              <div key={trade.id || idx} className="trade-card" onClick={() => openModal(trade)}>
                <div className="trade-card-header">
                  <div className="trade-date">
                    <span className="material-icons">calendar_today</span>
                    {format(parseISO(trade.date), 'MMM d, yyyy')}
                  </div>
                  <span className={`trade-result-badge ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                    <span className="material-icons">{getResultIcon(trade.targetHit, trade.pnl)}</span>
                    {trade.result}
                  </span>
                </div>
                <div className="trade-card-body">
                  <div className="trade-pnl-large">
                    <span className={trade.pnl >= 0 ? 'positive' : 'negative'}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </span>
                  </div>
                  <div className="trade-metrics-row">
                    <div className="trade-metric">
                      <span className="metric-label">%</span>
                      <span className={`metric-value ${trade.percentGainLoss >= 0 ? 'positive' : 'negative'}`}>
                        {trade.percentGainLoss.toFixed(2)}%
                      </span>
                    </div>
                    <div className="trade-metric">
                      <span className="metric-label">R:R</span>
                      <span className="metric-value">{trade.rrAchieved.toFixed(2)}x</span>
                    </div>
                    <div className="trade-metric">
                      <span className="metric-label">Balance</span>
                      <span className="metric-value">{formatCurrency(trade.closeBalance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTrade ? 'Edit Trade' : 'Add New Trade'}
        size="medium"
      >
        <form onSubmit={handleSubmit} className="trade-form">
          <div className="form-row">
            <div className="form-field">
              <label>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-field">
              <label>P&L ($)</label>
              <input
                type="number"
                value={formData.pnl}
                onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
                step="0.01"
                className="form-input"
                placeholder="146.48"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label>Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="form-textarea"
              placeholder="Add any notes about this trade..."
              rows="3"
            />
          </div>

          {formData.pnl && (
            <div className="preview-section">
              <h3 className="preview-title">Preview</h3>
              <div className="preview-grid">
                <div className="preview-item">
                  <span className="preview-label">Open Balance:</span>
                  <span className="preview-value">{formatCurrency(openBalance)}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Close Balance:</span>
                  <span className="preview-value">
                    {formatCurrency(openBalance + (parseFloat(formData.pnl) || 0))}
                  </span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">% Gain/Loss:</span>
                  <span className={`preview-value ${parseFloat(formData.pnl) >= 0 ? 'positive' : 'negative'}`}>
                    {(((parseFloat(formData.pnl) || 0) / openBalance) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Risk $:</span>
                  <span className="preview-value">
                    {formatCurrency((openBalance * settings.riskPercent) / 100)}
                  </span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Target $:</span>
                  <span className="preview-value">
                    {formatCurrency((openBalance * settings.riskPercent * settings.riskReward) / 100)}
                  </span>
                </div>
              </div>
              {parseFloat(formData.pnl) >= (openBalance * settings.riskPercent * settings.riskReward) / 100 && (
                <div className="target-hit">
                  <span className="material-icons">celebration</span>
                  Target Achieved!
                </div>
              )}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="button-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="button-primary">
              <span className="material-icons">{editingTrade ? 'save' : 'add'}</span>
              {editingTrade ? 'Update Trade' : 'Add Trade'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Dashboard
