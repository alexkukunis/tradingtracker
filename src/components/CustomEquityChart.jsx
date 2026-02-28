import React, { useMemo, useState, useRef, useEffect } from 'react'
import { formatCurrency } from '../utils/calculations'
import './CustomEquityChart.css'

// Smooth curve generation using Catmull-Rom spline
const generateSmoothPath = (points, tension = 0.5) => {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension
    const cp1y = p1.y + (p2.y - p0.y) / 6 * tension
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension
    const cp2y = p2.y - (p3.y - p1.y) / 6 * tension

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  return path
}

// Generate area path for gradient fill
const generateAreaPath = (points, height) => {
  if (points.length === 0) return ''
  const linePath = generateSmoothPath(points)
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`
}

function CustomEquityChart({ 
  data, 
  dataKey, 
  title, 
  color = '#00d4ff',
  gradientId = 'gradient',
  showPulse = true,
  formatValue = (v) => `$${v.toFixed(0)}`
}) {
  const [tooltip, setTooltip] = useState(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef(null)
  const svgRef = useRef(null)

  // Calculate dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: 400 })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { points: [], min: 0, max: 0, range: 0 }
    
    const values = data.map(d => d[dataKey])
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    
    const padding = range * 0.1 // 10% padding
    const adjustedMin = min - padding
    const adjustedMax = max + padding
    const adjustedRange = adjustedMax - adjustedMin

    const margin = { top: 40, right: 40, bottom: 60, left: 70 }
    const chartWidth = dimensions.width - margin.left - margin.right
    const chartHeight = dimensions.height - margin.top - margin.bottom

    const points = data.map((d, index) => {
      const x = margin.left + (index / (data.length - 1 || 1)) * chartWidth
      const y = margin.top + chartHeight - ((d[dataKey] - adjustedMin) / adjustedRange) * chartHeight
      return { x, y, value: d[dataKey], date: d.date, originalData: d }
    })

    return { points, min: adjustedMin, max: adjustedMax, range: adjustedRange, margin }
  }, [data, dataKey, dimensions])

  const handleMouseMove = (e) => {
    if (!svgRef.current || chartData.points.length === 0) return
    
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Find closest point
    let closestPoint = chartData.points[0]
    let minDistance = Math.abs(x - closestPoint.x)

    chartData.points.forEach(point => {
      const distance = Math.abs(x - point.x)
      if (distance < minDistance) {
        minDistance = distance
        closestPoint = point
      }
    })

    // Only show tooltip if close enough
    if (minDistance < 50) {
      setTooltip({
        x: closestPoint.x,
        y: closestPoint.y,
        data: closestPoint.originalData,
        value: closestPoint.value
      })
    } else {
      setTooltip(null)
    }
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  if (!data || data.length === 0) {
    return (
      <div className="custom-chart-container" ref={containerRef}>
        <div className="custom-chart-empty">
          <span className="material-icons">show_chart</span>
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const { points, min, max, margin } = chartData
  const lastPoint = points[points.length - 1]

  return (
    <div className="custom-chart-container" ref={containerRef}>
      <div className="custom-chart-header">
        <h3>{title}</h3>
        {lastPoint && (
          <div className="chart-current-value" style={{ color }}>
            {formatValue(lastPoint.value)}
          </div>
        )}
      </div>
      
      <div className="custom-chart-wrapper">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="custom-chart-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="50%" stopColor={color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <g className="chart-grid">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = margin.top + (dimensions.height - margin.top - margin.bottom) * (1 - ratio)
              const value = min + (max - min) * ratio
              return (
                <g key={i}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={dimensions.width - margin.right}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    opacity="0.3"
                  />
                  <text
                    x={margin.left - 10}
                    y={y + 4}
                    fill="#64748b"
                    fontSize="11"
                    textAnchor="end"
                    className="chart-axis-label"
                  >
                    {formatValue(value)}
                  </text>
                </g>
              )
            })}
          </g>

          {/* Area fill */}
          {points.length > 0 && (
            <path
              d={generateAreaPath(points, dimensions.height - margin.bottom)}
              fill={`url(#${gradientId})`}
              className="chart-area"
            />
          )}

          {/* Main line */}
          {points.length > 0 && (
            <path
              d={generateSmoothPath(points, 0.5)}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="chart-line"
              filter="url(#glow)"
            />
          )}

          {/* Interactive points (invisible but for hover) */}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="8"
              fill="transparent"
              className="chart-point-interactive"
            />
          ))}

          {/* Tooltip indicator line */}
          {tooltip && (
            <g className="chart-tooltip-indicator">
              <line
                x1={tooltip.x}
                y1={margin.top}
                x2={tooltip.x}
                y2={dimensions.height - margin.bottom}
                stroke={color}
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.5"
              />
              <circle
                cx={tooltip.x}
                cy={tooltip.y}
                r="6"
                fill={color}
                stroke="#0ea5e9"
                strokeWidth="2"
                className="chart-tooltip-dot"
              />
            </g>
          )}

          {/* Pulsing dot at the end */}
          {showPulse && lastPoint && (
            <g className="chart-pulse-dot">
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="10"
                fill={color}
                opacity="0.2"
                className="pulse-ring-outer"
              />
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="8"
                fill={color}
                opacity="0.3"
                className="pulse-ring-middle"
              />
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="5"
                fill={color}
                stroke="#0ea5e9"
                strokeWidth="2"
                className="pulse-dot-core"
              />
            </g>
          )}

          {/* X-axis labels */}
          <g className="chart-x-axis">
            {points.map((point, index) => {
              if (index % Math.ceil(points.length / 8) !== 0 && index !== points.length - 1) return null
              return (
                <text
                  key={index}
                  x={point.x}
                  y={dimensions.height - margin.bottom + 20}
                  fill="#64748b"
                  fontSize="11"
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {point.date}
                </text>
              )
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="custom-chart-tooltip"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y - 80}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="tooltip-header">{tooltip.data.date}</div>
            <div className="tooltip-content">
              <div className="tooltip-row">
                <span className="tooltip-label">Value:</span>
                <span className="tooltip-value" style={{ color }}>
                  {formatValue(tooltip.value)}
                </span>
              </div>
              {tooltip.data.pnl !== undefined && (
                <div className="tooltip-row">
                  <span className="tooltip-label">P&L:</span>
                  <span className={`tooltip-value ${tooltip.data.pnl >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(tooltip.data.pnl)}
                  </span>
                </div>
              )}
              {tooltip.data.cumulativePnL !== undefined && (
                <div className="tooltip-row">
                  <span className="tooltip-label">Cum. P&L:</span>
                  <span className={`tooltip-value ${tooltip.data.cumulativePnL >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(tooltip.data.cumulativePnL)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomEquityChart
