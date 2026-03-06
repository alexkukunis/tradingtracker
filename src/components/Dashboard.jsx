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
    { pnl: '', notes: '', instrument: '', stopLoss: '', takeProfit: '' }
  ])
  const [showBulkPaste, setShowBulkPaste] = useState(false)
  const [bulkPasteText, setBulkPasteText] = useState('')

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
      setTradeEntries([{ 
        pnl: trade.pnl.toString(), 
        notes: trade.notes || '',
        instrument: trade.instrument || '',
        stopLoss: trade.stopLoss ? trade.stopLoss.toString() : '',
        takeProfit: trade.takeProfit ? trade.takeProfit.toString() : ''
      }])
    } else {
      setEditingTrade(null)
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        pnl: '',
        notes: ''
      })
      setTradeEntries([{ pnl: '', notes: '', instrument: '', stopLoss: '', takeProfit: '' }])
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
    setTradeEntries([{ pnl: '', notes: '', instrument: '', stopLoss: '', takeProfit: '' }])
    setShowBulkPaste(false)
    setBulkPasteText('')
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
        result: getResultMessage(metrics.targetHit, pnl),
        instrument: entry.instrument || null,
        stopLoss: entry.stopLoss ? parseFloat(entry.stopLoss) : null,
        takeProfit: entry.takeProfit ? parseFloat(entry.takeProfit) : null
      }

      onUpdateTrade(editingTrade.id, tradeData)
      closeModal()
      return
    }

    // Handle multiple entries submission
    if (validEntries.length > 1) {
      // Group trades by date and process chronologically
      const tradesByDate = {}
      validEntries.forEach(entry => {
        const tradeDate = entry.date || formData.date
        if (!tradesByDate[tradeDate]) {
          tradesByDate[tradeDate] = []
        }
        tradesByDate[tradeDate].push(entry)
      })

      // Sort dates chronologically
      const sortedDates = Object.keys(tradesByDate).sort((a, b) => {
        return parseDateLocal(a).getTime() - parseDateLocal(b).getTime()
      })

      const tradesToAdd = []
      let currentBalance = settings.startingBalance

      // Process trades date by date
      for (const date of sortedDates) {
        const dateTrades = tradesByDate[date]
        const dateBalance = getOpenBalance(date)
        currentBalance = dateBalance

        for (const entry of dateTrades) {
          const pnl = parseFloat(entry.pnl) || 0
          const tradeId = `${date}-${Date.now()}-${Math.random()}`
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
            date: date,
            day: getDayName(date),
            pnl: Math.round(pnl * 100) / 100,
            openBalance: Math.round(openBalance * 100) / 100,
            ...metricsWithoutCumulative,
            notes: entry.notes || '',
            result: getResultMessage(metrics.targetHit, pnl),
            instrument: entry.instrument || null,
            stopLoss: entry.stopLoss ? parseFloat(entry.stopLoss) : null,
            takeProfit: entry.takeProfit ? parseFloat(entry.takeProfit) : null
          }

          tradesToAdd.push(tradeData)
          currentBalance = metrics.closeBalance
        }
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
      result: getResultMessage(metrics.targetHit, pnl),
      instrument: entry.instrument || null,
      stopLoss: entry.stopLoss ? parseFloat(entry.stopLoss) : null,
      takeProfit: entry.takeProfit ? parseFloat(entry.takeProfit) : null
    }

    onAddTrade(tradeData)
    closeModal()
  }

  const addTradeEntry = () => {
    setTradeEntries([...tradeEntries, { pnl: '', notes: '', instrument: '', stopLoss: '', takeProfit: '' }])
  }

  // Parse bulk paste format
  const parseBulkPaste = (text) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(line => line.length > 0)
    const trades = []
    let i = 0

    while (i < lines.length) {
      // Look for "Currency flag" pattern or instrument name
      if (lines[i].includes('Currency flag') || lines[i].match(/^[A-Z0-9]{2,}$/)) {
        let instrument = ''
        
        // Extract instrument name
        if (lines[i].includes('Currency flag')) {
          // Instrument is usually on the next line
          if (i + 1 < lines.length && lines[i + 1].match(/^[A-Z0-9]{2,}$/)) {
            instrument = lines[i + 1]
            i += 2 // Skip both "Currency flag" and instrument lines
          } else {
            i++
            continue
          }
        } else {
          // Instrument is on this line
          instrument = lines[i]
          i++
        }

        if (i >= lines.length) break

        // Collect trade data - might span multiple lines
        const tradeDataLines = []
        while (i < lines.length && !lines[i].includes('Currency flag') && !lines[i].match(/^[A-Z0-9]{2,}$/)) {
          tradeDataLines.push(lines[i])
          i++
        }

        // Join all trade data lines and parse
        const tradeDataText = tradeDataLines.join('\t')
        const parts = tradeDataText.split(/\t+/).filter(p => p.trim())
        
        if (parts.length >= 8) {
          try {
            // Parse date: format "2026/03/06 18:50:41" or "2026/03/06"
            let dateStr = parts[0]
            if (parts[1] && parts[1].match(/^\d{2}:\d{2}:\d{2}$/)) {
              dateStr = parts[0] + ' ' + parts[1]
            }
            
            const [datePart] = dateStr.split(/\s+/)
            const [year, month, day] = datePart.split('/')
            if (!year || !month || !day) {
              i++
              continue
            }
            const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

            // Parse values - typical order after date/time:
            // Type, Direction, Volume, Entry Price, Stop Loss, Take Profit, Close Date, Close Time, Close Price, Commission, Swap, Profit, Net Profit, IDs
            
            let entryPrice = ''
            let stopLoss = ''
            let takeProfit = ''
            let netProfit = ''

            // Find entry price (usually index 4-5, after Volume)
            for (let j = 3; j < Math.min(6, parts.length); j++) {
              const val = parts[j]?.replace(/[,$]/g, '').trim()
              if (val && /^\d+\.?\d*$/.test(val) && parseFloat(val) > 100) { // Entry prices are usually > 100
                entryPrice = val
                break
              }
            }

            // Find stop loss (usually after entry price, might be on separate line in original)
            for (let j = 4; j < Math.min(8, parts.length); j++) {
              const val = parts[j]?.replace(/[,$-]/g, '').trim()
              if (val && val !== '-' && /^\d+\.?\d*$/.test(val)) {
                if (!stopLoss) {
                  stopLoss = val
                } else if (!takeProfit && val !== stopLoss) {
                  takeProfit = val
                  break
                }
              }
            }

            // Find net profit - look for values with $ sign near the end
            for (let j = parts.length - 1; j >= Math.max(0, parts.length - 6); j--) {
              const part = parts[j]?.trim()
              if (part && part.includes('$')) {
                const match = part.replace(/[,$]/g, '').match(/-?\d+\.?\d*/)
                if (match && !part.match(/^\d{15,}$/)) { // Not an ID
                  netProfit = match[0]
                  break
                }
              }
            }

            // If still no net profit, look for last numeric value before long IDs
            if (!netProfit) {
              for (let j = parts.length - 1; j >= Math.max(0, parts.length - 4); j--) {
                const part = parts[j]?.trim()
                if (part && part.includes('$')) {
                  const match = part.replace(/[,$]/g, '').match(/-?\d+\.?\d*/)
                  if (match) {
                    netProfit = match[0]
                    break
                  }
                } else if (part && /^-?\d+\.?\d*$/.test(part.replace(/[,$]/g, '')) && !part.match(/^\d{15,}$/)) {
                  netProfit = part.replace(/[,$]/g, '')
                  break
                }
              }
            }

            if (netProfit && date) {
              trades.push({
                date,
                pnl: netProfit,
                instrument: instrument || '',
                stopLoss: stopLoss || '',
                takeProfit: takeProfit || '',
                entryPrice: entryPrice || '',
                notes: instrument ? `${instrument}${entryPrice ? ` @ ${entryPrice}` : ''}` : ''
              })
            }
          } catch (error) {
            console.error('Error parsing trade:', error, parts)
          }
        }
      } else {
        i++
      }
    }

    return trades
  }

  const handleBulkPaste = () => {
    if (!bulkPasteText.trim()) {
      toast.error('Please paste trade data')
      return
    }

    const parsedTrades = parseBulkPaste(bulkPasteText)
    
    if (parsedTrades.length === 0) {
      toast.error('Could not parse any trades from the pasted data. Please check the format.')
      return
    }

    // Group trades by date and convert to tradeEntries format
    const groupedByDate = {}
    parsedTrades.forEach(trade => {
      if (!groupedByDate[trade.date]) {
        groupedByDate[trade.date] = []
      }
      groupedByDate[trade.date].push(trade)
    })

    // If all trades are on the same date, use that date, otherwise use today
    const dates = Object.keys(groupedByDate)
    const selectedDate = dates.length === 1 ? dates[0] : formData.date

    // Convert to tradeEntries format
    const newEntries = parsedTrades.map(trade => ({
      pnl: trade.pnl,
      notes: trade.notes,
      instrument: trade.instrument,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      entryPrice: trade.entryPrice,
      date: trade.date // Include date for multi-date support
    }))

    // Update form date if all trades are on same date
    if (dates.length === 1) {
      setFormData({ ...formData, date: dates[0] })
    }

    setTradeEntries(newEntries)
    setBulkPasteText('')
    setShowBulkPaste(false)
    toast.success(`Parsed ${parsedTrades.length} trade(s)`)
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
            {!editingTrade && (
              <button
                type="button"
                onClick={() => setShowBulkPaste(!showBulkPaste)}
                className="bulk-paste-toggle"
                style={{ marginLeft: 'auto', padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'transparent', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
              >
                <span className="material-icons" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>content_paste</span>
                {showBulkPaste ? 'Hide' : 'Bulk Paste'}
              </button>
            )}
          </div>

          {showBulkPaste && !editingTrade && (
            <div className="bulk-paste-section" style={{ marginBottom: '1rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#aaa' }}>
                Paste trade data (from trading platform export):
              </label>
              <textarea
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder="Paste your trade data here..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '0.75rem',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleBulkPaste}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#4a9eff',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Parse & Add Trades
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkPasteText('')
                    setShowBulkPaste(false)
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
                    {(entry.instrument || entry.stopLoss || entry.takeProfit) && (
                      <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {entry.instrument && <span>📊 {entry.instrument}</span>}
                        {entry.stopLoss && <span>🛑 SL: {entry.stopLoss}</span>}
                        {entry.takeProfit && <span>🎯 TP: {entry.takeProfit}</span>}
                      </div>
                    )}
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
