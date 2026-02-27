import React, { useState, useMemo, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, getDaysInMonth, startOfWeek, endOfWeek } from 'date-fns'
import { formatCurrency } from '../utils/calculations'
import './CalendarView.css'

function CalendarView({ trades, settings, onTradeClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const todayRef = useRef(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const tradesByDate = useMemo(() => {
    const map = {}
    trades.forEach(trade => {
      const dateKey = format(parseISO(trade.date), 'yyyy-MM-dd')
      if (!map[dateKey]) {
        map[dateKey] = []
      }
      map[dateKey].push(trade)
    })
    return map
  }, [trades])

  const monthStats = useMemo(() => {
    const monthTrades = trades.filter(t => {
      const tradeDate = parseISO(t.date)
      return tradeDate.getMonth() === currentMonth.getMonth() &&
             tradeDate.getFullYear() === currentMonth.getFullYear()
    })

    const totalPnL = monthTrades.reduce((sum, t) => sum + t.pnl, 0)
    const winCount = monthTrades.filter(t => t.pnl > 0).length
    const lossCount = monthTrades.filter(t => t.pnl < 0).length
    const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length) * 100 : 0

    return {
      totalPnL,
      winCount,
      lossCount,
      totalTrades: monthTrades.length,
      winRate
    }
  }, [trades, currentMonth])

  const allMonthsStats = useMemo(() => {
    const monthMap = {}
    trades.forEach(trade => {
      const tradeDate = parseISO(trade.date)
      const monthKey = format(tradeDate, 'yyyy-MM')
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { trades: [], totalPnL: 0 }
      }
      monthMap[monthKey].trades.push(trade)
      monthMap[monthKey].totalPnL += trade.pnl
    })

    const months = Object.entries(monthMap).map(([key, data]) => ({
      month: key,
      totalPnL: data.totalPnL,
      tradeCount: data.trades.length
    }))

    return months.sort((a, b) => b.totalPnL - a.totalPnL)
  }, [trades])

  const bestMonth = allMonthsStats[0]

  const getDayTrades = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    return tradesByDate[dateKey] || []
  }

  const getDayPnL = (day) => {
    const dayTrades = getDayTrades(day)
    return dayTrades.reduce((sum, t) => sum + t.pnl, 0)
  }

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  const focusToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    setSelectedDate(today)
    // Scroll to today after a brief delay to allow render
    setTimeout(() => {
      if (todayRef.current) {
        todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }
    }, 100)
  }

  const selectedDayTrades = selectedDate ? getDayTrades(selectedDate) : []

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={() => navigateMonth(-1)} className="nav-button">
            <span className="material-icons">chevron_left</span>
            Prev
          </button>
          <h2 className="calendar-month">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
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

        <div className="month-stats">
          <div className="stat-box">
            <span className="stat-label">Month P&L</span>
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
        </div>

        {bestMonth && (
          <div className="best-month-banner">
            <span className="material-icons">emoji_events</span>
            Best Month: {format(parseISO(bestMonth.month + '-01'), 'MMMM yyyy')} - {formatCurrency(bestMonth.totalPnL)}
          </div>
        )}
      </div>

      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}

        {days.map(day => {
          const dayTrades = getDayTrades(day)
          const dayPnL = getDayPnL(day)
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
          const isToday = isSameDay(day, new Date())
          const isSelected = selectedDate && isSameDay(day, selectedDate)

          return (
            <div
              key={day.toISOString()}
              ref={isToday ? todayRef : null}
              className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayTrades.length > 0 ? 'has-trades' : ''}`}
              onClick={() => {
                setSelectedDate(day)
              }}
            >
              <div className="day-number">{format(day, 'd')}</div>
              {dayTrades.length > 0 && (
                <div className="day-info">
                  <div className="trade-count">{dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}</div>
                  <div className={`day-pnl ${dayPnL >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(dayPnL)}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedDate && (
        <div className="day-details">
          <div className="day-details-header">
            <h3>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
            <button onClick={() => setSelectedDate(null)} className="close-button">
              <span className="material-icons">close</span>
            </button>
          </div>
          {selectedDayTrades.length > 0 ? (
            <div className="day-trades-list">
              {selectedDayTrades.map((trade, idx) => (
              <div key={idx} className="day-trade-card">
                <div className="trade-header">
                  <span className={`trade-result ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                    {trade.result}
                  </span>
                  <span className="trade-pnl">{formatCurrency(trade.pnl)}</span>
                </div>
                <div className="trade-metrics">
                  <div className="metric">
                    <span className="metric-label">% Gain/Loss:</span>
                    <span className={`metric-value ${trade.percentGainLoss >= 0 ? 'positive' : 'negative'}`}>
                      {trade.percentGainLoss.toFixed(2)}%
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">R:R Achieved:</span>
                    <span className="metric-value">{trade.rrAchieved.toFixed(2)}x</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Open Balance:</span>
                    <span className="metric-value">{formatCurrency(trade.openBalance)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Close Balance:</span>
                    <span className="metric-value">{formatCurrency(trade.closeBalance)}</span>
                  </div>
                </div>
                {trade.notes && (
                  <div className="trade-notes">
                    <strong>Notes:</strong> {trade.notes}
                  </div>
                )}
              </div>
              ))}
            </div>
          ) : (
            <div className="no-trades-message">
              <span className="material-icons">info</span>
              <p>No trades recorded for this day.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CalendarView
