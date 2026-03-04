import React, { useState, useMemo, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { formatCurrency, parseDateLocal, getResultIcon } from '../utils/calculations'
import './CalendarView.css'

function CalendarView({ trades, settings, onTradeClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const todayRef = useRef(null)

  const monthStart    = startOfMonth(currentMonth)
  const monthEnd      = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd   = endOfWeek(monthEnd)
  const days          = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const tradesByDate = useMemo(() => {
    const map = {}
    trades.forEach(trade => {
      const key = format(parseDateLocal(trade.date), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(trade)
    })
    return map
  }, [trades])

  const monthStats = useMemo(() => {
    const mt = trades.filter(t => {
      const d = parseDateLocal(t.date)
      return d.getMonth() === currentMonth.getMonth() &&
             d.getFullYear() === currentMonth.getFullYear()
    })
    const totalPnL  = mt.reduce((s, t) => s + t.pnl, 0)
    const winCount  = mt.filter(t => t.pnl > 0).length
    const lossCount = mt.filter(t => t.pnl < 0).length
    const winRate   = mt.length > 0 ? (winCount / mt.length) * 100 : 0
    return { totalPnL, winCount, lossCount, totalTrades: mt.length, winRate }
  }, [trades, currentMonth])

  const bestMonth = useMemo(() => {
    const mm = {}
    trades.forEach(t => {
      const k = format(parseDateLocal(t.date), 'yyyy-MM')
      if (!mm[k]) mm[k] = { totalPnL: 0 }
      mm[k].totalPnL += t.pnl
    })
    const entries = Object.entries(mm)
    if (!entries.length) return null
    return entries.reduce((best, [k, v]) =>
      v.totalPnL > (best ? best.totalPnL : -Infinity) ? { month: k, ...v } : best
    , null)
  }, [trades])

  const getDayTrades = (day) => tradesByDate[format(day, 'yyyy-MM-dd')] || []
  const getDayPnL    = (day) => getDayTrades(day).reduce((s, t) => s + t.pnl, 0)

  const navigateMonth = (dir) => {
    setCurrentMonth(prev => {
      const d = new Date(prev)
      d.setMonth(prev.getMonth() + dir)
      return d
    })
  }

  const focusToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    setSelectedDate(today)
    setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }, 100)
  }

  const selectedDayTrades = selectedDate ? getDayTrades(selectedDate) : []
  const selectedDayPnL    = selectedDayTrades.reduce((s, t) => s + t.pnl, 0)

  return (
    <div className="calendar-container">

      {/* ── Navigation ── */}
      <div className="calendar-nav">
        <button onClick={() => navigateMonth(-1)} className="nav-button">
          <span className="material-icons">chevron_left</span>
          Prev
        </button>
        <h2 className="calendar-month">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="nav-actions">
          <button onClick={focusToday} className="today-button">
            <span className="material-icons">today</span>
            Today
          </button>
          <button onClick={() => navigateMonth(1)} className="nav-button">
            Next
            <span className="material-icons">chevron_right</span>
          </button>
        </div>
      </div>

      {/* ── Month Stats ── */}
      <div className="month-stats">
        <div className="stat-box">
          <span className="stat-label">Month P&amp;L</span>
          <span className={`stat-value ${monthStats.totalPnL >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(monthStats.totalPnL)}
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Trades</span>
          <span className="stat-value">{monthStats.totalTrades}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Win Rate</span>
          <span className="stat-value">{monthStats.winRate.toFixed(1)}%</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Wins / Losses</span>
          <span className="stat-value">
            <span style={{ color: 'var(--accent-success)' }}>{monthStats.winCount}</span>
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '1rem' }}> / </span>
            <span style={{ color: 'var(--accent-danger)' }}>{monthStats.lossCount}</span>
          </span>
        </div>
        {bestMonth && (
          <div className="best-month-banner">
            <span className="material-icons">emoji_events</span>
            Best: {format(parseDateLocal(bestMonth.month + '-01'), 'MMM yyyy')} · {formatCurrency(bestMonth.totalPnL)}
          </div>
        )}
      </div>

      {/* ── Calendar Grid ── */}
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="calendar-day-header">{d}</div>
        ))}
        {days.map(day => {
          const dayTrades      = getDayTrades(day)
          const dayPnL         = getDayPnL(day)
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
          const isToday        = isSameDay(day, new Date())
          const isSelected     = selectedDate && isSameDay(day, selectedDate)
          const hasTrades      = dayTrades.length > 0
          const isWin          = hasTrades && dayPnL > 0
          const isLoss         = hasTrades && dayPnL < 0

          return (
            <div
              key={day.toISOString()}
              ref={isToday ? todayRef : null}
              className={[
                'calendar-day',
                !isCurrentMonth ? 'other-month' : '',
                isToday        ? 'today'       : '',
                isSelected     ? 'selected'    : '',
                hasTrades      ? 'has-trades'  : '',
                isWin          ? 'win-day'     : '',
                isLoss         ? 'loss-day'    : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDate(day)}
            >
              <div className="day-number">{format(day, 'd')}</div>
              {hasTrades && (
                <div className="day-info">
                  <div className="trade-count">
                    {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}
                  </div>
                  <div className={`day-pnl ${dayPnL >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(dayPnL)}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Day Details Panel ── */}
      {selectedDate && (
        <div className="day-details">

          <div className="day-details-header">
            <div className="day-details-title-group">
              <h3>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
              {selectedDayTrades.length > 0 && (
                <div className="day-summary-badges">
                  <span className={`day-total-pnl-badge ${selectedDayPnL >= 0 ? 'positive' : 'negative'}`}>
                    {selectedDayPnL >= 0 ? '+' : ''}{formatCurrency(selectedDayPnL)}
                  </span>
                  <span className="day-trade-count-badge">
                    {selectedDayTrades.length} trade{selectedDayTrades.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
            <button onClick={() => setSelectedDate(null)} className="close-button">
              <span className="material-icons">close</span>
            </button>
          </div>

          {selectedDayTrades.length > 0 ? (
            <div className="day-trades-list">
              {selectedDayTrades.map((trade, idx) => {
                const rrHit   = trade.rrAchieved >= (settings?.riskReward || 1)
                const hasSL   = trade.stopLoss != null
                const hasTP   = trade.takeProfit != null
                const slValue = trade.stopLoss
                const tpValue = trade.takeProfit
                const isWin   = trade.pnl >= 0

                return (
                  <div key={idx} className={`dtc ${isWin ? 'dtc--win' : 'dtc--loss'}`}>

                    {/* ── Row 1: meta (badges) + PnL block ── */}
                    <div className="dtc__top">
                      <div className="dtc__meta">
                        <span className={`badge badge--result ${isWin ? 'badge--win' : 'badge--loss'}`}>
                          <span className="material-icons">{getResultIcon(trade.targetHit, trade.pnl)}</span>
                          {trade.result}
                        </span>
                      </div>

                      <div className="dtc__pnl-block">
                        <span className={`dtc__pnl ${isWin ? 'positive' : 'negative'}`}>
                          {isWin ? '+' : ''}{formatCurrency(trade.pnl)}
                        </span>
                        <span className={`badge badge--result ${isWin ? 'badge--win' : 'badge--loss'}${trade.targetHit ? ' badge--crushed' : ''}`}>
                          <span className="material-icons">{getResultIcon(trade.targetHit, trade.pnl)}</span>
                          {trade.result}
                        </span>
                      </div>
                    </div>

                    {/* ── Row 2: SL / TP (from manual fields) ── */}
                    {hasSL || hasTP ? (
                      <div className="dtc__prices">
                        {hasSL && (
                          <>
                            <span className="dtc__price-sep">·</span>
                            <div className="dtc__price-pair">
                              <span className="dtc__price-label">SL</span>
                              <span className="dtc__price-val dtc__price-val--sl">{slValue}</span>
                            </div>
                          </>
                        )}
                        {hasTP && (
                          <>
                            <span className="dtc__price-sep">·</span>
                            <div className="dtc__price-pair">
                              <span className="dtc__price-label">TP</span>
                              <span className="dtc__price-val dtc__price-val--tp">{tpValue}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* ── Row 3: stats footer ── */}
                    <div className="dtc__stats">
                      <div className="dtc__stat">
                        <span className="dtc__stat-label">% Gain/Loss</span>
                        <span className={`dtc__stat-val ${trade.percentGain >= 0 ? 'positive' : 'negative'}`}>
                          {trade.percentGain >= 0 ? '+' : ''}{trade.percentGain.toFixed(2)}%
                        </span>
                      </div>
                      <div className="dtc__stat-divider" />
                      <div className="dtc__stat">
                        <span className="dtc__stat-label">R:R Achieved</span>
                        <span className={`badge badge--rr ${rrHit ? 'badge--rr-hit' : ''}`}>
                          {trade.rrAchieved.toFixed(2)}x
                        </span>
                      </div>
                    </div>

                    {/* ── Notes ── */}
                    {trade.notes && (
                      <div className="dtc__notes">
                        <span className="dtc__notes-label">Notes</span>
                        <p>{trade.notes}</p>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>
          ) : (
            <div className="no-trades-message">
              <span className="material-icons">calendar_today</span>
              <p>No trades on this day.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CalendarView
