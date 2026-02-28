import React, { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { tradelockerAPI } from '../services/api'
import './Settings.css'

// Returns a human-readable "X ago" string for a given date
function timeAgo(date) {
  if (!date) return null
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function Settings({
  settings,
  onSave,
  onSync
}) {
  const [formData, setFormData] = useState(settings)
  const [tradelockerStatus, setTradelockerStatus] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showConnectForm, setShowConnectForm] = useState(false)
  // Tracks the timestamp of the last sync for the "Last updated X ago" display
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  // Ticks every 30s to re-render the relative time string (no API calls)
  const [, setTimeTick] = useState(0)
  const tickRef = useRef(null)
  const [connectForm, setConnectForm] = useState({
    email: '',
    password: '',
    server: '',          // Actual broker server name shown in TradeLocker login screen
    environment: 'live', // "live" or "demo" — selects the API base URL
    accountId: ''
  })
  const [availableAccounts, setAvailableAccounts] = useState([])

  // Sync formData when settings prop changes (e.g., after save or initial load)
  useEffect(() => {
    if (settings) {
      setFormData({
        startingBalance: settings.startingBalance ?? 1000,
        riskPercent: settings.riskPercent ?? 2,
        riskReward: settings.riskReward ?? 3
      })
    }
  }, [settings])

  useEffect(() => {
    loadTradeLockerStatus()
  }, [])

  // Refresh the "X ago" display every 30 seconds — no API calls, just a re-render
  useEffect(() => {
    tickRef.current = setInterval(() => setTimeTick(t => t + 1), 30_000)
    return () => clearInterval(tickRef.current)
  }, [])

  const loadTradeLockerStatus = async () => {
    try {
      const status = await tradelockerAPI.getStatus()
      setTradelockerStatus(status)
      if (status.connected) {
        setShowConnectForm(false)
        // Seed the "last updated" timestamp from the server
        if (status.account?.lastSyncedAt) {
          setLastSyncedAt(status.account.lastSyncedAt)
        }
      }
    } catch (error) {
      console.error('Failed to load TradeLocker status:', error)
    }
  }

  const handleConnect = async (e) => {
    e.preventDefault()
    setConnecting(true)
    try {
      const result = await tradelockerAPI.connect(
        connectForm.email,
        connectForm.password,
        connectForm.server,
        connectForm.environment,
        connectForm.accountId || null
      )
      
      if (result.accounts && result.accounts.length > 1 && !connectForm.accountId) {
        // Multiple accounts returned — show selection dropdown and wait for user to pick one
        setAvailableAccounts(result.accounts)
        toast.info(`${result.accounts.length} accounts found — please select the one you want to sync`)
        return
      }

      toast.success('TradeLocker account connected successfully!')
      setShowConnectForm(false)
      setConnectForm({ email: '', password: '', server: '', environment: 'live', accountId: '' })
      await loadTradeLockerStatus()
    } catch (error) {
      toast.error(error.message || 'Failed to connect TradeLocker account')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your TradeLocker account?')) {
      return
    }
    try {
      await tradelockerAPI.disconnect()
      toast.success('TradeLocker account disconnected')
      setTradelockerStatus({ connected: false })
    } catch (error) {
      toast.error('Failed to disconnect TradeLocker account')
    }
  }

  const handleSync = async (mode = 'refresh') => {
    setSyncing(true)
    try {
      const result = await tradelockerAPI.sync(mode)
      const newCount     = result.tradesCreated ?? 0
      const skippedCount = result.tradesSkipped  ?? 0

      if (newCount > 0) {
        const skippedNote = skippedCount > 0
          ? ` (${skippedCount} already synced, skipped)`
          : ''
        if (mode === 'initial') {
          toast.success(`✅ ${newCount} trade${newCount !== 1 ? 's' : ''} imported from your last 100${skippedNote}`)
        } else {
          toast.success(`✅ ${newCount} new trade${newCount !== 1 ? 's' : ''} synced${skippedNote}`)
        }
      } else if (skippedCount > 0) {
        toast.info(`✅ Already up to date — ${skippedCount} trade${skippedCount !== 1 ? 's' : ''} already synced, nothing new`)
      } else {
        toast.info('✅ Already up to date — no new trades found')
      }

      // Update the "last updated" display immediately from the response timestamp
      if (result.lastSyncedAt) {
        setLastSyncedAt(result.lastSyncedAt)
      } else {
        setLastSyncedAt(new Date().toISOString())
      }

      if (onSync) {
        await onSync()
      }
    } catch (error) {
      toast.error(error.message || 'Failed to sync trades from TradeLocker')
    } finally {
      setSyncing(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    // Store the raw string while the user is typing so they can clear the field
    // and enter a new number without it snapping back to 0.
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Parse to numbers only on save, defaulting to 0 if blank
      const parsed = {
        ...formData,
        startingBalance: parseFloat(formData.startingBalance) || 0,
        riskPercent:     parseFloat(formData.riskPercent)     || 0,
        riskReward:      parseFloat(formData.riskReward)      || 0,
      }
      await onSave(parsed)
      toast.success('Settings saved successfully!')
    } catch (error) {
      toast.error('Failed to save settings. Please try again.')
    }
  }

  return (
    <div className="settings-container">
      <div className="settings-card">
        <h2 className="settings-title">
          <span className="material-icons">settings</span>
          Trading Settings
        </h2>
        <p className="settings-subtitle">Configure your trading parameters</p>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-group">
            <label htmlFor="startingBalance" className="form-label">
              Starting Balance ($)
            </label>
            <input
              type="number"
              id="startingBalance"
              name="startingBalance"
              value={formData.startingBalance}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="form-input"
              required
            />
            <p className="form-hint">Your initial trading capital</p>
          </div>

          <div className="form-group">
            <label htmlFor="riskPercent" className="form-label">
              Risk Per Trade (%)
            </label>
            <input
              type="number"
              id="riskPercent"
              name="riskPercent"
              value={formData.riskPercent}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="100"
              className="form-input"
              required
            />
            <p className="form-hint">Percentage of balance to risk per trade</p>
          </div>

          <div className="form-group">
            <label htmlFor="riskReward" className="form-label">
              Risk to Reward Ratio
            </label>
            <input
              type="number"
              id="riskReward"
              name="riskReward"
              value={formData.riskReward}
              onChange={handleChange}
              step="0.1"
              min="0"
              className="form-input"
              required
            />
            <p className="form-hint">Target profit relative to risk (e.g., 3 = 1:3)</p>
          </div>

          <div className="settings-preview">
            <h3>Preview</h3>
            <div className="preview-grid">
              <div className="preview-item">
                <span className="preview-label">Risk Amount:</span>
                <span className="preview-value">
                  ${(((parseFloat(formData.startingBalance) || 0) * (parseFloat(formData.riskPercent) || 0)) / 100).toFixed(2)}
                </span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Target Amount:</span>
                <span className="preview-value">
                  ${(((parseFloat(formData.startingBalance) || 0) * (parseFloat(formData.riskPercent) || 0) * (parseFloat(formData.riskReward) || 0)) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <button type="submit" className="save-button">
            <span className="material-icons">save</span>
            Save Settings
          </button>
        </form>
      </div>

      {/* TradeLocker Integration */}
      <div className="settings-card">
        <h2 className="settings-title">
          <span className="material-icons">sync</span>
          TradeLocker Integration
        </h2>
        <p className="settings-subtitle">Connect your TradeLocker account to automatically sync trades</p>

        {tradelockerStatus?.connected ? (
          <div className="tradelocker-connected">
            <div className="connection-status">
              <span className="material-icons status-icon connected">check_circle</span>
              <div>
                <p className="status-text">Connected to TradeLocker</p>
                <p className="status-details">
                  Account: {tradelockerStatus.account?.email}
                </p>
                <p className="status-details">
                  Server: {tradelockerStatus.account?.server} &mdash; {tradelockerStatus.account?.environment === 'demo' ? 'Demo' : 'Live'}
                </p>
              </div>
            </div>
            <div className="tradelocker-actions">
              {!lastSyncedAt ? (
                // ── First-time / no previous sync ─────────────────────────────
                <button
                  onClick={() => handleSync('initial')}
                  disabled={syncing}
                  className={`sync-button${syncing ? ' syncing' : ''}`}
                >
                  <span className={`material-icons${syncing ? ' spin' : ''}`}>download</span>
                  {syncing ? 'Importing trades…' : 'Sync Last 100 Trades'}
                </button>
              ) : (
                // ── Subsequent refreshes ──────────────────────────────────────
                <button
                  onClick={() => handleSync('refresh')}
                  disabled={syncing}
                  className={`sync-button${syncing ? ' syncing' : ''}`}
                >
                  <span className={`material-icons${syncing ? ' spin' : ''}`}>refresh</span>
                  {syncing ? 'Checking for new trades…' : 'Refresh'}
                </button>
              )}
              <button
                onClick={handleDisconnect}
                className="disconnect-button"
              >
                <span className="material-icons">link_off</span>
                Disconnect
              </button>
            </div>

            {/* Last updated / status line */}
            <div className="last-updated-row">
              {syncing ? (
                <span className="last-updated-text">
                  <span className="material-icons last-updated-icon">hourglass_top</span>
                  Fetching latest closed positions…
                </span>
              ) : lastSyncedAt ? (
                <span className="last-updated-text">
                  <span className="material-icons last-updated-icon">schedule</span>
                  Last updated {timeAgo(lastSyncedAt)}
                </span>
              ) : (
                <span className="last-updated-text muted">
                  <span className="material-icons last-updated-icon">info_outline</span>
                  Not yet synced — click "Sync Last 100 Trades" to import your recent closed positions
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="tradelocker-disconnected">
            {!showConnectForm ? (
              <button 
                onClick={() => setShowConnectForm(true)}
                className="connect-button"
              >
                <span className="material-icons">link</span>
                Connect TradeLocker Account
              </button>
            ) : (
              <form onSubmit={handleConnect} className="connect-form">
                <div className="form-group">
                  <label htmlFor="tl-email" className="form-label">
                    TradeLocker Email
                  </label>
                  <input
                    type="email"
                    id="tl-email"
                    value={connectForm.email}
                    onChange={(e) => setConnectForm({ ...connectForm, email: e.target.value })}
                    className="form-input"
                    required
                    placeholder="your@email.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tl-password" className="form-label">
                    TradeLocker Password
                  </label>
                  <input
                    type="password"
                    id="tl-password"
                    value={connectForm.password}
                    onChange={(e) => setConnectForm({ ...connectForm, password: e.target.value })}
                    className="form-input"
                    required
                    placeholder="Your TradeLocker password"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tl-server" className="form-label">
                    Server Name
                  </label>
                  <input
                    type="text"
                    id="tl-server"
                    value={connectForm.server}
                    onChange={(e) => setConnectForm({ ...connectForm, server: e.target.value })}
                    className="form-input"
                    required
                    placeholder="e.g. TradeLocker-Live"
                  />
                  <p className="form-hint">
                    The server name shown on the TradeLocker login screen (not "live" or "demo" — the exact broker server name).
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="tl-environment" className="form-label">
                    Account Type
                  </label>
                  <select
                    id="tl-environment"
                    value={connectForm.environment}
                    onChange={(e) => setConnectForm({ ...connectForm, environment: e.target.value })}
                    className="form-input"
                  >
                    <option value="live">Live</option>
                    <option value="demo">Demo</option>
                  </select>
                  <p className="form-hint">
                    Select Live to connect to live.tradelocker.com, or Demo for demo.tradelocker.com.
                  </p>
                </div>

                {availableAccounts.length > 1 && (
                  <div className="form-group">
                    <label htmlFor="tl-account" className="form-label">
                      Select Account
                    </label>
                    <select
                      id="tl-account"
                      value={connectForm.accountId}
                      onChange={(e) => setConnectForm({ ...connectForm, accountId: e.target.value })}
                      className="form-input"
                    >
                      <option value="">Select an account...</option>
                      {availableAccounts.map((acc, idx) => (
                        <option key={idx} value={acc.accountId || acc.id}>
                          ID: {acc.accountId || acc.id} — Acc# {acc.accNum ?? idx + 1}{acc.name ? ` — ${acc.name}` : ''}{acc.currency ? ` (${acc.currency})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="connect-form-actions">
                  <button 
                    type="submit" 
                    disabled={connecting}
                    className="connect-submit-button"
                  >
                    {connecting ? 'Connecting...' : 'Connect'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowConnectForm(false)
                      setConnectForm({ email: '', password: '', server: '', environment: 'live', accountId: '' })
                      setAvailableAccounts([])
                    }}
                    className="cancel-button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings
