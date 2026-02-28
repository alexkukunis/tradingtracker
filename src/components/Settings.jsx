import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { tradelockerAPI } from '../services/api'
import './Settings.css'

function Settings({ settings, onSave, onSync }) {
  const [formData, setFormData] = useState(settings)
  const [tradelockerStatus, setTradelockerStatus] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [connectForm, setConnectForm] = useState({
    email: '',
    password: '',
    server: '',          // Actual broker server name shown in TradeLocker login screen
    environment: 'live', // "live" or "demo" — selects the API base URL
    accountId: ''
  })
  const [availableAccounts, setAvailableAccounts] = useState([])

  useEffect(() => {
    loadTradeLockerStatus()
  }, [])

  const loadTradeLockerStatus = async () => {
    try {
      const status = await tradelockerAPI.getStatus()
      setTradelockerStatus(status)
      if (status.connected) {
        setShowConnectForm(false)
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

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await tradelockerAPI.sync()
      const newCount     = result.tradesCreated ?? 0
      const skippedCount = result.tradesSkipped  ?? 0

      if (newCount > 0) {
        // New trades were found and saved
        const skippedNote = skippedCount > 0
          ? ` (${skippedCount} already synced, skipped)`
          : ''
        toast.success(`✅ ${newCount} new trade${newCount !== 1 ? 's' : ''} synced${skippedNote}`)
      } else if (skippedCount > 0) {
        // Fetched trades but all were already in the DB
        toast.info(`✅ Already up to date — ${skippedCount} trade${skippedCount !== 1 ? 's' : ''} already synced, nothing new`)
      } else {
        // Nothing fetched at all (e.g. no closed trades in the account)
        toast.info('✅ Already up to date — no new trades found')
      }

      if (onSync) {
        await onSync()
      }
      await loadTradeLockerStatus()
    } catch (error) {
      toast.error(error.message || 'Failed to sync trades from TradeLocker')
    } finally {
      setSyncing(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await onSave(formData)
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
                  ${((formData.startingBalance * formData.riskPercent) / 100).toFixed(2)}
                </span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Target Amount:</span>
                <span className="preview-value">
                  ${((formData.startingBalance * formData.riskPercent * formData.riskReward) / 100).toFixed(2)}
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
                {tradelockerStatus.account?.lastSyncedAt && (
                  <p className="status-details">
                    Last synced: {new Date(tradelockerStatus.account.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="tradelocker-actions">
              <button 
                onClick={handleSync} 
                disabled={syncing}
                className={`sync-button${syncing ? ' syncing' : ''}`}
              >
                <span className={`material-icons${syncing ? ' spin' : ''}`}>sync</span>
                {syncing ? 'Syncing new trades…' : 'Sync New Trades'}
              </button>
              <button 
                onClick={handleDisconnect}
                className="disconnect-button"
              >
                <span className="material-icons">link_off</span>
                Disconnect
              </button>
            </div>
            {!syncing && (
              <p className="form-hint sync-hint">
                <span className="material-icons" style={{ fontSize: '13px', verticalAlign: 'middle' }}>info_outline</span>
                {' '}Only new trades not yet in your journal will be added. Already synced trades are automatically skipped.
              </p>
            )}
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
