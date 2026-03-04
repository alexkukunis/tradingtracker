import React, { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
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
    </div>
  )
}

export default Settings
