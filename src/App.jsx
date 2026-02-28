import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import Settings from './components/Settings'
import Dashboard from './components/Dashboard'
import CalendarView from './components/CalendarView'
import TradeHistory from './components/TradeHistory'
import EquityCurve from './components/EquityCurve'
import Goals from './components/Goals'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import Register from './components/Register'
import { recalculateBalances } from './utils/calculations'
import { authAPI, tradesAPI, settingsAPI, getToken } from './services/api'
import './App.css'

// Defined OUTSIDE App so React never sees it as a new component type on re-render
function ProtectedRoute({ user, children }) {
  return user ? children : <Navigate to="/login" replace />
}

function App() {
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState({
    startingBalance: 1000,
    riskPercent: 2,
    riskReward: 3
  })
  const [trades, setTrades] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  // Simulation mode — lets users override live account data for goal projections
  const [simulationMode, setSimulationMode] = useState(false)
  const [simBalance, setSimBalance] = useState(10000)
  const [simWinRate, setSimWinRate] = useState(55)
  const navigate = useNavigate()
  const location = useLocation()

  // Sync activeTab with current route
  useEffect(() => {
    const routeToTab = {
      '/': 'dashboard',
      '/history': 'history',
      '/calendar': 'calendar',
      '/equity': 'equity',
      '/goals': 'goals',
      '/settings': 'settings'
    }
    const tab = routeToTab[location.pathname] || 'dashboard'
    setActiveTab(tab)
  }, [location.pathname])

  // Check authentication on mount (also runs on page refresh)
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken()
      if (token) {
        try {
          const data = await authAPI.getCurrentUser()
          setUser(data.user)
          await loadUserData()
        } catch (error) {
          console.error('Auth check failed:', error)
          authAPI.logout()
          setUser(null)
        }
      }
      setLoading(false)
    }
    checkAuth()
  }, [])

  // Load user data (settings and trades)
  const loadUserData = async () => {
    try {
      const [settingsData, tradesData] = await Promise.all([
        settingsAPI.get(),
        tradesAPI.getAll()
      ])
      setSettings(settingsData)
      setTrades(tradesData || [])
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
  }

  // Recalculate balances whenever trades or settings change
  const recalculatedTrades = useMemo(() => {
    return recalculateBalances(trades, settings.startingBalance)
  }, [trades, settings.startingBalance])

  const handleLogin = async (userData, token) => {
    setUser(userData)
    await loadUserData()
    navigate('/')
  }

  const handleRegister = async (userData, token) => {
    setUser(userData)
    await loadUserData()
    navigate('/')
  }

  const handleLogout = () => {
    authAPI.logout()
    setUser(null)
    setSettings({ startingBalance: 1000, riskPercent: 2, riskReward: 3 })
    setTrades([])
    navigate('/login')
  }

  const saveSettings = async (newSettings) => {
    try {
      const updated = await settingsAPI.update(newSettings)
      setSettings(updated)
      toast.success('Settings saved successfully!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings. Please try again.')
      throw error
    }
  }

  const addTrade = async (tradeData) => {
    try {
      const newTrade = await tradesAPI.create(tradeData)
      setTrades(prevTrades => [...prevTrades, newTrade])
      toast.success('Trade saved successfully!')
    } catch (error) {
      console.error('Failed to add trade:', error)
      toast.error('Failed to save trade. Please try again.')
      throw error
    }
  }

  const deleteTrade = async (id) => {
    try {
      await tradesAPI.delete(id)
      setTrades(prevTrades => prevTrades.filter(t => t.id !== id))
    } catch (error) {
      console.error('Failed to delete trade:', error)
      throw error
    }
  }

  const clearAllData = async () => {
    if (window.confirm('Are you sure you want to delete ALL trading data? This cannot be undone.')) {
      try {
        // Delete all trades
        await Promise.all(trades.map(trade => tradesAPI.delete(trade.id)))
        setTrades([])
        toast.success('All trading data has been cleared.')
      } catch (error) {
        console.error('Failed to clear data:', error)
        toast.error('Failed to clear all data. Please try again.')
      }
    }
  }

  const updateTrade = async (id, updatedTrade) => {
    try {
      const updated = await tradesAPI.update(id, updatedTrade)
      setTrades(prevTrades => prevTrades.map(t => t.id === id ? updated : t))
      toast.success('Trade updated successfully!')
    } catch (error) {
      console.error('Failed to update trade:', error)
      toast.error('Failed to update trade. Please try again.')
      throw error
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register onRegister={handleRegister} />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute user={user}>
            <div className={`app ${isMobileExpanded ? 'sidebar-expanded' : ''}`}>
              <Sidebar 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                isMobileOpen={isMobileMenuOpen}
                onMobileClose={() => setIsMobileMenuOpen(false)}
                isMobileExpanded={isMobileExpanded}
                onMobileToggle={() => setIsMobileExpanded(!isMobileExpanded)}
                user={user}
                onLogout={handleLogout}
              />
              <main className="app-main">
                <Routes>
                  <Route
                    path="/"
                    element={
                      <Dashboard
                        settings={settings}
                        trades={recalculatedTrades}
                        onAddTrade={addTrade}
                        onUpdateTrade={updateTrade}
                      />
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <CalendarView
                        trades={recalculatedTrades}
                        settings={settings}
                        onTradeClick={(date) => {
                          setActiveTab('dashboard')
                          navigate('/')
                        }}
                      />
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <TradeHistory
                        trades={recalculatedTrades}
                        settings={settings}
                        onDelete={deleteTrade}
                        onUpdate={updateTrade}
                        onClearAll={clearAllData}
                      />
                    }
                  />
                  <Route
                    path="/equity"
                    element={<EquityCurve trades={recalculatedTrades} settings={settings} />}
                  />
                  <Route
                    path="/goals"
                    element={
                      <Goals
                        trades={recalculatedTrades}
                        settings={settings}
                        simulationMode={simulationMode}
                        onSimulationModeChange={setSimulationMode}
                        simBalance={simBalance}
                        onSimBalanceChange={setSimBalance}
                        simWinRate={simWinRate}
                        onSimWinRateChange={setSimWinRate}
                      />
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <Settings
                        settings={settings}
                        onSave={saveSettings}
                        onSync={loadUserData}
                        simulationMode={simulationMode}
                        onSimulationModeChange={setSimulationMode}
                        simBalance={simBalance}
                        onSimBalanceChange={setSimBalance}
                        simWinRate={simWinRate}
                        onSimWinRateChange={setSimWinRate}
                      />
                    }
                  />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
