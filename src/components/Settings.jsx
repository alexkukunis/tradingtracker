import React, { useState } from 'react'
import './Settings.css'

function Settings({ settings, onSave }) {
  const [formData, setFormData] = useState(settings)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
    alert('Settings saved successfully!')
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
    </div>
  )
}

export default Settings
