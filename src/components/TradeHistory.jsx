import React, { useMemo, useState, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { formatCurrency, calculateCumulativePnL, getResultIcon, calculateTradeMetrics, getDayName, getResultMessage } from '../utils/calculations'
import Modal from './Modal'
import './TradeHistory.css'

function TradeHistory({ trades, settings, onDelete, onUpdate, onClearAll }) {
  const [editingTrade, setEditingTrade] = useState(null)
  const [viewingTrade, setViewingTrade] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [tradeToDelete, setTradeToDelete] = useState(null)
  const [openDropdownId, setOpenDropdownId] = useState(null)
  const dropdownRefs = useRef({})
  const [formData, setFormData] = useState({
    date: '',
    pnl: '',
    notes: ''
  })

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (dateCompare !== 0) return dateCompare
      return (a.id || '').localeCompare(b.id || '')
    })
  }, [trades])

  const tradesWithCumulative = useMemo(() => {
    return calculateCumulativePnL(sortedTrades)
  }, [sortedTrades])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId === null) return
      
      // Get the dropdown container for the currently open dropdown
      const dropdownRef = dropdownRefs.current[openDropdownId]
      if (!dropdownRef) return
      
      // Check if click is outside the dropdown container
      if (!dropdownRef.contains(event.target)) {
        setOpenDropdownId(null)
      }
    }

    // Use a small timeout to ensure the click event that opened the dropdown completes first
    const timeoutId = setTimeout(() => {
      if (openDropdownId !== null) {
        // Use 'click' event instead of 'mousedown' to avoid race conditions
        document.addEventListener('click', handleClickOutside, true)
      }
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [openDropdownId])

  const openViewModal = (trade) => {
    setViewingTrade(trade)
    setIsViewModalOpen(true)
  }

  const closeViewModal = () => {
    setIsViewModalOpen(false)
    setViewingTrade(null)
  }

  const openEditModal = (trade) => {
    setEditingTrade(trade)
    setFormData({
      date: trade.date,
      pnl: trade.pnl.toString(),
      notes: trade.notes || ''
    })
    setIsEditModalOpen(true)
    setOpenDropdownId(null)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingTrade(null)
    setFormData({
      date: '',
      pnl: '',
      notes: ''
    })
  }

  const handleRowClick = (trade, e) => {
    // Don't open modal if clicking on dropdown or action buttons
    if (e.target.closest('.action-dropdown') || e.target.closest('.dropdown-menu')) {
      return
    }
    openViewModal(trade)
  }

  const toggleDropdown = (tradeId, e) => {
    e.stopPropagation()
    e.preventDefault()
    // Use functional update to ensure we get the latest state
    setOpenDropdownId(prevId => prevId === tradeId ? null : tradeId)
  }

  const handleDeleteClick = (trade, e) => {
    e.stopPropagation()
    setTradeToDelete(trade)
    setIsDeleteModalOpen(true)
    setOpenDropdownId(null)
  }

  const confirmDelete = () => {
    if (tradeToDelete) {
      onDelete(tradeToDelete.id)
      setIsDeleteModalOpen(false)
      setTradeToDelete(null)
    }
  }

  const cancelDelete = () => {
    setIsDeleteModalOpen(false)
    setTradeToDelete(null)
  }

  const handleUpdate = (e) => {
    e.preventDefault()
    if (!editingTrade) return

    const pnl = parseFloat(formData.pnl) || 0
    
    // Find the open balance for this trade (balance before this trade in chronological order)
    const tradeIndex = sortedTrades.findIndex(t => t.id === editingTrade.id)
    let openBalance = settings.startingBalance
    if (tradeIndex > 0) {
      openBalance = sortedTrades[tradeIndex - 1].closeBalance || settings.startingBalance
    } else if (tradeIndex === 0) {
      // Check if there are any trades before this date
      const tradesBefore = sortedTrades.filter(t => {
        const tradeDate = new Date(t.date)
        const editDate = new Date(formData.date)
        return tradeDate < editDate || (tradeDate.getTime() === editDate.getTime() && t.id < editingTrade.id)
      })
      if (tradesBefore.length > 0) {
        const sortedBefore = [...tradesBefore].sort((a, b) => {
          const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
          if (dateCompare !== 0) return dateCompare
          return (a.id || '').localeCompare(b.id || '')
        })
        openBalance = sortedBefore[sortedBefore.length - 1].closeBalance || settings.startingBalance
      }
    }

    const metrics = calculateTradeMetrics(
      pnl,
      openBalance,
      settings.riskPercent,
      settings.riskReward
    )

    const updatedTrade = {
      ...editingTrade,
      date: formData.date,
      day: getDayName(formData.date),
      pnl: Math.round(pnl * 100) / 100,
      openBalance: Math.round(openBalance * 100) / 100,
      ...metrics,
      notes: formData.notes,
      result: getResultMessage(metrics.targetHit, pnl)
    }

    onUpdate(editingTrade.id, updatedTrade)
    closeEditModal()
  }

  if (trades.length === 0) {
    return (
      <div className="history-container">
        <div className="empty-state">
          <div className="empty-icon">
            <span className="material-icons">bar_chart</span>
          </div>
          <h2>No Trades Yet</h2>
          <p>Start tracking your trades by adding your first entry in the Dashboard!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>
          <span className="material-icons">history</span>
          Trade History
        </h2>
        <div className="history-actions">
          <button onClick={onClearAll} className="clear-button">
            <span className="material-icons">delete_sweep</span>
            Clear All Data
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="table-container desktop-view">
        <table className="trade-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>P&L</th>
              <th>%</th>
              <th>Balance</th>
              <th>R:R</th>
              <th>Result</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tradesWithCumulative.map((trade, idx) => (
              <tr 
                key={trade.id || idx} 
                className={`${trade.pnl >= 0 ? 'win-row' : 'loss-row'} clickable-row`}
                onClick={(e) => handleRowClick(trade, e)}
              >
                <td>
                  <div className="date-cell">
                    <div className="date-primary">{format(parseISO(trade.date), 'MMM d, yyyy')}</div>
                    <div className="date-secondary">{trade.day}</div>
                  </div>
                </td>
                <td className={trade.pnl >= 0 ? 'positive' : 'negative'}>
                  {formatCurrency(trade.pnl)}
                </td>
                <td className={trade.percentGainLoss >= 0 ? 'positive' : 'negative'}>
                  {trade.percentGainLoss.toFixed(2)}%
                </td>
                <td>
                  <div className="balance-cell">
                    <div className="balance-label">Close</div>
                    <div className="balance-value">{formatCurrency(trade.closeBalance)}</div>
                  </div>
                </td>
                <td>
                  <span className={`rr-badge ${trade.rrAchieved >= trade.riskReward ? 'target-hit' : ''}`}>
                    {trade.rrAchieved.toFixed(2)}x
                  </span>
                </td>
                <td>
                  <span className={`result-badge ${trade.pnl >= 0 ? 'positive' : 'negative'} ${trade.targetHit ? 'crushed' : ''}`}>
                    <span className="material-icons">{getResultIcon(trade.targetHit, trade.pnl)}</span>
                    {trade.result}
                  </span>
                </td>
                <td>
                  <div 
                    className="action-dropdown"
                    ref={(el) => {
                      if (el) {
                        dropdownRefs.current[trade.id] = el
                      } else {
                        delete dropdownRefs.current[trade.id]
                      }
                    }}
                  >
                    <button
                      onClick={(e) => toggleDropdown(trade.id, e)}
                      className="dropdown-toggle"
                      title="Actions"
                      aria-expanded={openDropdownId === trade.id}
                      type="button"
                    >
                      <span className="material-icons">more_vert</span>
                    </button>
                    {openDropdownId === trade.id && (
                      <div 
                        className="dropdown-menu" 
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(trade)
                          }}
                          className="dropdown-item"
                          type="button"
                        >
                          <span className="material-icons">edit</span>
                          Edit
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(trade, e)}
                          className="dropdown-item delete"
                          type="button"
                        >
                          <span className="material-icons">delete</span>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="mobile-view">
        {tradesWithCumulative.map((trade, idx) => (
          <div 
            key={trade.id || idx} 
            className={`trade-card-mobile ${trade.pnl >= 0 ? 'win' : 'loss'}`}
            onClick={() => openViewModal(trade)}
          >
            <div className="trade-card-header-mobile">
              <div>
                <div className="trade-date-mobile">
                  <span className="material-icons">calendar_today</span>
                  {format(parseISO(trade.date), 'MMM d, yyyy')} • {trade.day}
                </div>
                <div className={`trade-pnl-mobile ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                </div>
              </div>
              <span className={`result-badge-mobile ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                <span className="material-icons">{getResultIcon(trade.targetHit, trade.pnl)}</span>
                {trade.result}
              </span>
            </div>
            
            <div className="trade-card-body-mobile">
              <div className="trade-metrics-mobile">
                <div className="metric-item-mobile">
                  <span className="metric-label-mobile">% Gain/Loss</span>
                  <span className={`metric-value-mobile ${trade.percentGainLoss >= 0 ? 'positive' : 'negative'}`}>
                    {trade.percentGainLoss.toFixed(2)}%
                  </span>
                </div>
                <div className="metric-item-mobile">
                  <span className="metric-label-mobile">Close Balance</span>
                  <span className="metric-value-mobile">{formatCurrency(trade.closeBalance)}</span>
                </div>
                <div className="metric-item-mobile">
                  <span className="metric-label-mobile">R:R Achieved</span>
                  <span className={`metric-value-mobile ${trade.rrAchieved >= trade.riskReward ? 'positive' : ''}`}>
                    {trade.rrAchieved.toFixed(2)}x
                  </span>
                </div>
              </div>
            </div>

            <div className="trade-card-actions-mobile">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openEditModal(trade)
                }}
                className="edit-button-mobile"
              >
                <span className="material-icons">edit</span>
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteClick(trade, e)
                }}
                className="delete-button-mobile"
              >
                <span className="material-icons">delete</span>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="history-summary">
        <div className="summary-card">
          <span className="summary-label">Total Trades</span>
          <span className="summary-value">{trades.length}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Wins</span>
          <span className="summary-value positive">
            {trades.filter(t => t.pnl > 0).length}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Losses</span>
          <span className="summary-value negative">
            {trades.filter(t => t.pnl < 0).length}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total P&L</span>
          <span className={`summary-value ${tradesWithCumulative[tradesWithCumulative.length - 1]?.cumulativePnL >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(tradesWithCumulative[tradesWithCumulative.length - 1]?.cumulativePnL || 0)}
          </span>
        </div>
      </div>

      {/* View Trade Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={closeViewModal}
        title={viewingTrade ? `Trade Details - ${format(parseISO(viewingTrade.date), 'MMM d, yyyy')}` : 'Trade Details'}
        size="medium"
      >
        {viewingTrade && (
          <div className="trade-details-modal">
            <div className="trade-details-header">
              <div className={`trade-result-large ${viewingTrade.pnl >= 0 ? 'positive' : 'negative'}`}>
                <span className="material-icons">{getResultIcon(viewingTrade.targetHit, viewingTrade.pnl)}</span>
                <div>
                  <div className="result-label">{viewingTrade.result}</div>
                  <div className="result-pnl">
                    {viewingTrade.pnl >= 0 ? '+' : ''}{formatCurrency(viewingTrade.pnl)}
                  </div>
                </div>
              </div>
            </div>

            <div className="trade-details-grid">
              <div className="detail-item">
                <span className="detail-label">Date</span>
                <span className="detail-value">{format(parseISO(viewingTrade.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Day</span>
                <span className="detail-value">{viewingTrade.day}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">P&L</span>
                <span className={`detail-value ${viewingTrade.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(viewingTrade.pnl)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">% Gain/Loss</span>
                <span className={`detail-value ${viewingTrade.percentGainLoss >= 0 ? 'positive' : 'negative'}`}>
                  {viewingTrade.percentGainLoss.toFixed(2)}%
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Open Balance</span>
                <span className="detail-value">{formatCurrency(viewingTrade.openBalance)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Close Balance</span>
                <span className="detail-value">{formatCurrency(viewingTrade.closeBalance)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Risk $</span>
                <span className="detail-value">{formatCurrency(viewingTrade.riskDollar)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Target $</span>
                <span className="detail-value">{formatCurrency(viewingTrade.targetDollar)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">R:R Achieved</span>
                <span className={`detail-value ${viewingTrade.rrAchieved >= viewingTrade.riskReward ? 'positive' : ''}`}>
                  {viewingTrade.rrAchieved.toFixed(2)}x
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Cumulative P&L</span>
                <span className={`detail-value ${viewingTrade.cumulativePnL >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(viewingTrade.cumulativePnL)}
                </span>
              </div>
            </div>

            {viewingTrade.notes && (
              <div className="trade-notes-section">
                <span className="notes-section-label">Notes</span>
                <div className="notes-content">{viewingTrade.notes}</div>
              </div>
            )}

            <div className="trade-details-actions">
              <button
                onClick={() => {
                  closeViewModal()
                  openEditModal(viewingTrade)
                }}
                className="button-primary"
              >
                <span className="material-icons">edit</span>
                Edit Trade
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Trade Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="Edit Trade"
        size="medium"
      >
        <form onSubmit={handleUpdate} className="trade-form">
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

          <div className="form-actions">
            <button type="button" className="button-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" className="button-primary">
              <span className="material-icons">save</span>
              Update Trade
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={cancelDelete}
        title="Delete Trade"
        size="small"
      >
        <div className="delete-confirmation">
          <div className="delete-confirmation-icon">
            <span className="material-icons">warning</span>
          </div>
          <div className="delete-confirmation-content">
            <h3>Are you sure you want to delete this trade?</h3>
            {tradeToDelete && (
              <div className="delete-confirmation-details">
                <div className="delete-trade-info">
                  <span className="delete-trade-date">
                    {format(parseISO(tradeToDelete.date), 'MMM d, yyyy')}
                  </span>
                  <span className={`delete-trade-pnl ${tradeToDelete.pnl >= 0 ? 'positive' : 'negative'}`}>
                    {tradeToDelete.pnl >= 0 ? '+' : ''}{formatCurrency(tradeToDelete.pnl)}
                  </span>
                </div>
                <p className="delete-confirmation-warning">
                  This action cannot be undone.
                </p>
              </div>
            )}
          </div>
          <div className="delete-confirmation-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={cancelDelete}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button-danger"
              onClick={confirmDelete}
            >
              <span className="material-icons">delete</span>
              Delete Trade
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TradeHistory
