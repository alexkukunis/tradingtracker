import React, { useState, useEffect, useMemo } from 'react'
import Settings from './components/Settings'
import Dashboard from './components/Dashboard'
import CalendarView from './components/CalendarView'
import TradeHistory from './components/TradeHistory'
import EquityCurve from './components/EquityCurve'
import Sidebar from './components/Sidebar'
import { recalculateBalances } from './utils/calculations'
import './App.css'

const STORAGE_KEYS = {
  SETTINGS: 'trading_tracker_settings',
  TRADES: 'trading_tracker_trades'
}

function App() {
  const [settings, setSettings] = useState({
    startingBalance: 1000,
    riskPercent: 2,
    riskReward: 3
  })
  const [trades, setTrades] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }

    // Load trades from localStorage
    const savedTrades = localStorage.getItem(STORAGE_KEYS.TRADES)
    if (savedTrades) {
      const parsedTrades = JSON.parse(savedTrades)
      // Ensure all trades have IDs (for backward compatibility)
      const tradesWithIds = parsedTrades.map(trade => ({
        ...trade,
        id: trade.id || `${trade.date}-${Date.now()}-${Math.random()}`
      }))
      // Recalculate balances on load
      const recalculated = recalculateBalances(tradesWithIds, JSON.parse(savedSettings)?.startingBalance || 1000)
      setTrades(recalculated)
    }
  }, [])

  // Recalculate balances whenever trades or settings change
  const recalculatedTrades = useMemo(() => {
    return recalculateBalances(trades, settings.startingBalance)
  }, [trades, settings.startingBalance])

  const saveSettings = (newSettings) => {
    setSettings(newSettings)
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings))
  }

  const addTrade = (tradeData) => {
    // Add unique ID if not present
    const tradeWithId = {
      ...tradeData,
      id: tradeData.id || `${tradeData.date}-${Date.now()}-${Math.random()}`
    }
    const newTrades = [...trades, tradeWithId]
    // Recalculate balances after adding
    const recalculated = recalculateBalances(newTrades, settings.startingBalance)
    setTrades(recalculated)
    localStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(recalculated))
  }

  const deleteTrade = (id) => {
    const newTrades = trades.filter(t => t.id !== id)
    // Recalculate balances after deleting
    const recalculated = recalculateBalances(newTrades, settings.startingBalance)
    setTrades(recalculated)
    localStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(recalculated))
  }

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to delete ALL trading data? This cannot be undone.')) {
      setTrades([])
      localStorage.removeItem(STORAGE_KEYS.TRADES)
      alert('All trading data has been cleared.')
    }
  }

  const updateTrade = (id, updatedTrade) => {
    const newTrades = trades.map(t => t.id === id ? { ...updatedTrade, id } : t)
    // Recalculate balances after updating
    const recalculated = recalculateBalances(newTrades, settings.startingBalance)
    setTrades(recalculated)
    localStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(recalculated))
  }

  return (
    <div className={`app ${isMobileExpanded ? 'sidebar-expanded' : ''}`}>
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        isMobileExpanded={isMobileExpanded}
        onMobileToggle={() => setIsMobileExpanded(!isMobileExpanded)}
      />
      <main className="app-main">
        {activeTab === 'dashboard' && (
          <Dashboard
            settings={settings}
            trades={recalculatedTrades}
            onAddTrade={addTrade}
            onUpdateTrade={updateTrade}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarView
            trades={recalculatedTrades}
            settings={settings}
            onTradeClick={(date) => {
              setActiveTab('dashboard')
            }}
          />
        )}
        {activeTab === 'history' && (
          <TradeHistory
            trades={recalculatedTrades}
            settings={settings}
            onDelete={deleteTrade}
            onUpdate={updateTrade}
            onClearAll={clearAllData}
          />
        )}
        {activeTab === 'equity' && (
          <EquityCurve trades={recalculatedTrades} settings={settings} />
        )}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            onSave={saveSettings}
          />
        )}
      </main>
    </div>
  )
}

export default App
