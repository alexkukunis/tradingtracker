import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { format, isSameDay } from 'date-fns'
import { toast } from 'sonner'
import { calculateTradeMetrics, getDayName, formatCurrency, getResultMessage, getResultIcon, parseDateLocal, recalculateBalances } from '../utils/calculations'
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
  const [tradeEntries, setTradeEntries] = useState([
    { pnl: '', notes: '' }
  ])

  const openModal = useCallback((trade = null) => {
    if (trade) {
      setEditingTrade(trade)
      // Convert date to YYYY-MM-DD format for date input
      const tradeDate = parseDateLocal(trade.date)
      const formattedDate = format(tradeDate, 'yyyy-MM-dd')
      setFormData({
        date: formattedDate,
        pnl: trade.pnl.toString(),
        notes: trade.notes || ''
      })
      setTradeEntries([{ pnl: trade.pnl.toString(), notes: trade.notes || '' }])
    } else {
      setEditingTrade(null)
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        pnl: '',
        notes: ''
      })
      setTradeEntries([{ pnl: '', notes: '' }])
    }
    setIsModalOpen(true)
  }, [])

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTrade(null)
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      pnl: '',
      notes: ''
    })
    setTradeEntries([{ pnl: '', notes: '' }])
  }

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only trigger if not typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }
      
      // Press 'a' to open add trade modal
      if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (!isModalOpen) {
          openModal(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isModalOpen, openModal])

  // Recalculate all trade metrics with current settings
  const tradesWithMetrics = useMemo(() => {
    if (!trades || trades.length === 0) return []
    
    // First, recalculate balances in chronological order
    const tradesWithBalances = recalculateBalances(trades, settings.startingBalance)
    
    // Then recalculate metrics for each trade with current settings
    return tradesWithBalances.map(trade => {
      const metrics = calculateTradeMetrics(
        trade.pnl,
        trade.openBalance,
        settings.riskPercent,
        settings.riskReward
      )
      
      return {
        ...trade,
        ...metrics,
        result: getResultMessage(metrics.targetHit, trade.pnl),
        riskReward: settings.riskReward // Store the risk:reward ratio for R:R display
      }
    })
  }, [trades, settings.startingBalance, settings.riskPercent, settings.riskReward])

  const getOpenBalance = useCallback((selectedDate, selectedTime = null) => {
    if (tradesWithMetrics.length === 0) return settings.startingBalance
    
    const selectedDateObj = parseDateLocal(selectedDate)
    
    // Get all trades before this date/time
    const sortedTrades = [...tradesWithMetrics]
      .filter(t => {
        const tradeDate = parseDateLocal(t.date)
        if (tradeDate < selectedDateObj) return true
        if (tradeDate.getTime() === selectedDateObj.getTime() && selectedTime && t.id && t.id < selectedTime) return true
        return false
      })
      .sort((a, b) => {
        const dateCompare = parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime()
        if (dateCompare !== 0) return dateCompare
        return (a.id || '').localeCompare(b.id || '')
      })
    
    if (sortedTrades.length === 0) return settings.startingBalance
    
    const lastTrade = sortedTrades[sortedTrades.length - 1]
    return lastTrade.closeBalance || settings.startingBalance
  }, [tradesWithMetrics, settings.startingBalance])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Check if we have multiple entries or single entry
    const hasMultipleEntries = tradeEntries.length > 1 || (tradeEntries.length === 1 && tradeEntries[0].pnl && tradeEntries[0].pnl.trim() !== '')
    const validEntries = tradeEntries.filter(entry => entry.pnl && entry.pnl.trim() !== '')
    
    if (validEntries.length === 0) {
      toast.error('Please add at least one trade entry')
      return
    }

    // If editing, only update the first entry
    if (editingTrade && validEntries.length > 0) {
      const entry = validEntries[0]
      const pnl = parseFloat(entry.pnl) || 0
      const tradeId = editingTrade.id
      const openBalance = getOpenBalance(formData.date, tradeId)
      
      const metrics = calculateTradeMetrics(
        pnl,
        openBalance,
        settings.riskPercent,
        settings.riskReward
      )

      const { cumulativePnL, ...metricsWithoutCumulative } = metrics

      const tradeData = {
        date: formData.date,
        day: getDayName(formData.date),
        pnl: Math.round(pnl * 100) / 100,
        openBalance: Math.round(openBalance * 100) / 100,
        ...metricsWithoutCumulative,
        notes: entry.notes || '',
        result: getResultMessage(metrics.targetHit, pnl)
      }

      onUpdateTrade(editingTrade.id, tradeData)
      closeModal()
      return
    }

    // Handle multiple entries submission
    if (validEntries.length > 1) {
      // Calculate trades in sequence for the same date
      let currentBalance = getOpenBalance(formData.date)
      const tradesToAdd = []

      for (const entry of validEntries) {
        const pnl = parseFloat(entry.pnl) || 0
        const tradeId = `${formData.date}-${Date.now()}-${Math.random()}`
        const openBalance = currentBalance
        
        const metrics = calculateTradeMetrics(
          pnl,
          openBalance,
          settings.riskPercent,
          settings.riskReward
        )

        const { cumulativePnL, ...metricsWithoutCumulative } = metrics

        const tradeData = {
          id: tradeId,
          date: formData.date,
          day: getDayName(formData.date),
          pnl: Math.round(pnl * 100) / 100,
          openBalance: Math.round(openBalance * 100) / 100,
          ...metricsWithoutCumulative,
          notes: entry.notes || '',
          result: getResultMessage(metrics.targetHit, pnl)
        }

        tradesToAdd.push(tradeData)
        currentBalance = metrics.closeBalance
      }

      // Add all trades sequentially
      try {
        for (const tradeData of tradesToAdd) {
          await onAddTrade(tradeData)
        }
        toast.success(`${tradesToAdd.length} trades added successfully!`)
        closeModal()
      } catch (error) {
        // Error already handled in onAddTrade
      }
      return
    }

    // Single trade submission
    const entry = validEntries[0]
    const pnl = parseFloat(entry.pnl) || 0
    const tradeId = `${formData.date}-${Date.now()}-${Math.random()}`
    const openBalance = getOpenBalance(formData.date, tradeId)
    
    const metrics = calculateTradeMetrics(
      pnl,
      openBalance,
      settings.riskPercent,
      settings.riskReward
    )

    const { cumulativePnL, ...metricsWithoutCumulative } = metrics

    const tradeData = {
      id: tradeId,
      date: formData.date,
      day: getDayName(formData.date),
      pnl: Math.round(pnl * 100) / 100,
      openBalance: Math.round(openBalance * 100) / 100,
      ...metricsWithoutCumulative,
      notes: entry.notes || '',
      result: getResultMessage(metrics.targetHit, pnl)
    }

    onAddTrade(tradeData)
    closeModal()
  }

  const addTradeEntry = () => {
    setTradeEntries([...tradeEntries, { pnl: '', notes: '' }])
  }

  const removeTradeEntry = (index) => {
    if (tradeEntries.length > 1) {
      setTradeEntries(tradeEntries.filter((_, i) => i !== index))
    }
  }

  const updateTradeEntry = (index, field, value) => {
    const updated = [...tradeEntries]
    updated[index] = { ...updated[index], [field]: value }
    setTradeEntries(updated)
  }

  const calculateStats = () => {
    if (tradesWithMetrics.length === 0) {
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

    // Sort trades by date to ensure correct order
    const sortedTrades = [...tradesWithMetrics].sort((a, b) => {
      const dateCompare = parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return (a.id || '').localeCompare(b.id || '')
    })

    const wins = sortedTrades.filter(t => t.pnl > 0)
    const losses = sortedTrades.filter(t => t.pnl < 0)
    const totalPnL = sortedTrades.reduce((sum, t) => sum + t.pnl, 0)
    const startingBalance = settings.startingBalance
    const currentBalance = sortedTrades.length > 0 
      ? sortedTrades[sortedTrades.length - 1].closeBalance 
      : startingBalance
    const totalPercent = ((currentBalance - startingBalance) / startingBalance) * 100

    const bestDay = [...sortedTrades].sort((a, b) => b.pnl - a.pnl)[0]
    const worstDay = [...sortedTrades].sort((a, b) => a.pnl - b.pnl)[0]

    const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0)
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0)

    return {
      totalPnL,
      totalPercent,
      winRate: sortedTrades.length > 0 ? (wins.length / sortedTrades.length) * 100 : 0,
      avgWin: wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0,
      avgLoss: losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0,
      bestDay,
      worstDay,
      currentBalance,
      totalTrades: sortedTrades.length,
      wins: wins.length,
      losses: losses.length,
      profitFactor
    }
  }

  const stats = calculateStats()
  const openBalance = getOpenBalance(formData.date)

  // Get today's trades
  const todayTrades = tradesWithMetrics.filter(t => isSameDay(parseDateLocal(t.date), new Date()))

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
          <span style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '0.25rem' }}>(A)</span>
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
            <div className="stat-meta">{stats.bestDay.date ? format(parseDateLocal(stats.bestDay.date), 'MMM d, yyyy') : '—'}</div>
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
            <div className="stat-meta">{stats.worstDay.date ? format(parseDateLocal(stats.worstDay.date), 'MMM d, yyyy') : '—'}</div>
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
                    <span>#{idx + 1}</span>
                  </div>
                  <span className={`trade-result-badge ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
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
                      <span className={`metric-value ${trade.percentGain >= 0 ? 'positive' : 'negative'}`}>
                        {trade.percentGain.toFixed(2)}%
                      </span>
                    </div>
                    <div className="trade-metric">
                      <span className="metric-label">R:R</span>
                      <span className="metric-value">{trade.rrAchieved.toFixed(2)}x</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tradesWithMetrics.length > 0 && (
        <div className="recent-trades">
          <h2 className="section-title">Recent Trades</h2>
          <div className="trades-list">
            {[...tradesWithMetrics].sort((a, b) => {
              const dateCompare = parseDateLocal(b.date).getTime() - parseDateLocal(a.date).getTime()
              if (dateCompare !== 0) return dateCompare
              return (b.id || '').localeCompare(a.id || '')
            }).slice(0, 5).map((trade, idx) => (
              <div key={trade.id || idx} className="trade-card" onClick={() => openModal(trade)}>
                <div className="trade-card-header">
                  <div className="trade-date">
                    <span className="material-icons">calendar_today</span>
                    <span>{format(parseDateLocal(trade.date), 'MMM d')}</span>
                  </div>
                  <span className={`trade-result-badge ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
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
                      <span className={`metric-value ${trade.percentGain >= 0 ? 'positive' : 'negative'}`}>
                        {trade.percentGain.toFixed(2)}%
                      </span>
                    </div>
                    <div className="trade-metric">
                      <span className="metric-label">R:R</span>
                      <span className="metric-value">{trade.rrAchieved.toFixed(2)}x</span>
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
        title={editingTrade ? 'Edit Trade' : 'Add Trade' + (tradeEntries.length > 1 ? ` (${tradeEntries.length} entries)` : '')}
        size="medium"
      >
        <form onSubmit={handleSubmit} className="trade-form-compact">
          <div className="compact-date-row">
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="compact-date-input"
              required
            />
            {tradeEntries.length > 1 && (
              <span className="compact-date-hint">{tradeEntries.length} trades</span>
            )}
          </div>

          <div className="compact-trades-list">
            {tradeEntries.map((entry, index) => {
              const entryPnl = parseFloat(entry.pnl) || 0
              let entryOpenBalance = getOpenBalance(formData.date)
              
              if (!editingTrade) {
                for (let i = 0; i < index; i++) {
                  const prevPnl = parseFloat(tradeEntries[i].pnl) || 0
                  entryOpenBalance += prevPnl
                }
              } else {
                entryOpenBalance = getOpenBalance(formData.date, editingTrade.id)
              }
              
              const entryMetrics = entryPnl ? calculateTradeMetrics(
                entryPnl,
                entryOpenBalance,
                settings.riskPercent,
                settings.riskReward
              ) : null

              return (
                <div key={index} className="compact-trade-row">
                  <div className="compact-trade-main">
                    <div className="compact-input-group">
                      <input
                        type="number"
                        value={entry.pnl}
                        onChange={(e) => updateTradeEntry(index, 'pnl', e.target.value)}
                        step="0.01"
                        className="compact-pnl-input"
                        placeholder="P&L"
                        required
                        autoFocus={index === 0 && !editingTrade && tradeEntries.length === 1}
                      />
                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) => updateTradeEntry(index, 'notes', e.target.value)}
                        className="compact-notes-input"
                        placeholder="Notes (optional)"
                      />
                    </div>
                    {entryMetrics && (
                      <div className="compact-preview">
                        <span className={`compact-return ${entryPnl >= 0 ? 'positive' : 'negative'}`}>
                          {entryPnl >= 0 ? '+' : ''}{entryMetrics.percentGain.toFixed(2)}%
                        </span>
                        {entryMetrics.targetHit && (
                          <span className="compact-target-badge" title="Target Hit">
                            <span className="material-icons">check_circle</span>
                          </span>
                        )}
                      </div>
                    )}
                    {tradeEntries.length > 1 && (
                      <button
                        type="button"
                        className="compact-remove-btn"
                        onClick={() => removeTradeEntry(index)}
                        title="Remove"
                      >
                        <span className="material-icons">close</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            
            <button 
              type="button" 
              className="compact-add-btn" 
              onClick={addTradeEntry}
              title="Add another trade"
            >
              <span className="material-icons">add</span>
              <span>Add Trade</span>
            </button>
          </div>

          <div className="compact-actions">
            <button type="button" className="btn-secondary-compact" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-compact">
              {editingTrade ? 'Update' : `Add ${tradeEntries.filter(e => e.pnl && e.pnl.trim() !== '').length || tradeEntries.length} Trade${tradeEntries.filter(e => e.pnl && e.pnl.trim() !== '').length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Dashboard
