import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { formatCurrency } from '../utils/calculations'
import './CumulativePnLChart.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

const detectPeaks = (points) => {
  if (points.length < 3) return []
  const peaks = []
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1]
    if (curr.value > prev.value && curr.value > next.value)
      peaks.push({ ...curr, index: i, type: 'peak' })
  }
  return peaks
}

// Catmull-Rom spline
const smoothPath = (pts, tension = 0.4) => {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension
    const cp1y = p1.y + (p2.y - p0.y) / 6 * tension
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension
    const cp2y = p2.y - (p3.y - p1.y) / 6 * tension
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

const areaPath = (pts, baseline) => {
  if (!pts.length) return ''
  return `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`
}

// ─── Component ───────────────────────────────────────────────────────────────

// Data occupies 76% of inner chart width; remaining 24% = "future" empty space
const DATA_RATIO = 0.76

function CumulativePnLChart({
  data,
  title = 'Account Balance Over Time',
  startingBalance = 0
}) {
  const [tooltip,  setTooltip]  = useState(null)
  const [dim,      setDim]      = useState({ width: 0, height: 0 })
  const [navIdx,   setNavIdx]   = useState(-1)
  const [isMobile, setIsMobile] = useState(false)

  const containerRef = useRef(null)
  const svgRef       = useRef(null)
  const rafRef       = useRef(null)
  const lastIdxRef   = useRef(null)

  // ── ResizeObserver ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const h = w < 400 ? 300 : w < 640 ? 350 : w < 1024 ? 420 : 480
      setIsMobile(w < 600)
      setDim({ width: w, height: h })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Margins — generous top/bottom so peak/valley label pills always fit ────
  const M = useMemo(() => ({
    top:    isMobile ? 54 : 72,   // room above chart for PEAK pill labels
    right:  14,
    bottom: isMobile ? 58 : 80,   // room below chart for VALLEY pill labels + x-axis
    left:   dim.width < 480 ? 68 : 84,
  }), [dim.width, isMobile])

  // ── Chart computation ─────────────────────────────────────────────────────
  const chart = useMemo(() => {
    if (!data?.length || !dim.width) {
      return { points: [], peaks: [], allMarkers: [], xLabels: [], yLines: [], dw: 0, cw: 0, ch: 0 }
    }

    const vals   = data.map(d => d.balance ?? (d.cumulativePnL + startingBalance))
    const rawMin = Math.min(...vals, startingBalance)
    const rawMax = Math.max(...vals, startingBalance)
    const range  = rawMax - rawMin || 1
    const pad    = range * 0.22
    const adjMin = rawMin - pad
    const adjMax = rawMax + pad
    const adjRange = adjMax - adjMin

    const cw = dim.width  - M.left - M.right
    const ch = dim.height - M.top  - M.bottom
    const dw = cw * DATA_RATIO   // actual data x-range

    const points = data.map((d, i) => {
      const value = d.balance ?? (d.cumulativePnL + startingBalance)
      const x = M.left + (i / Math.max(data.length - 1, 1)) * dw
      const y = M.top + ch - ((value - adjMin) / adjRange) * ch
      return { x, y, value, date: d.date, originalData: d, index: i }
    })

    const allPeaks = detectPeaks(points)
    // Find the highest point overall (could be a peak or at start/end)
    const highestPoint = points.reduce((max, point) => point.value > max.value ? point : max, points[0])
    // Only show the highest peak (the maximum equity balance point)
    const peaks = highestPoint ? [{ ...highestPoint, type: 'peak' }] : []
    const allMarkers = peaks

    // Smart x-axis labels
    const maxLabels = Math.max(2, Math.floor(dw / 72))
    const step      = Math.ceil(points.length / maxLabels)
    const xLabels   = points.filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0)

    // Y gridlines
    const yLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
      y:     M.top + ch * (1 - ratio),
      value: adjMin + adjRange * ratio,
    }))

    return { points, peaks, allMarkers, xLabels, yLines, dw, cw, ch }
  }, [data, dim, M, startingBalance])

  // ── Navigation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (chart.allMarkers.length > 0 && navIdx === -1) setNavIdx(0)
  }, [chart.allMarkers.length, navIdx])

  // ── Hover / Touch ─────────────────────────────────────────────────────────
  const handlePointer = useCallback((e) => {
    if (!svgRef.current || !chart.points.length) { setTooltip(null); return }
    const rect    = svgRef.current.getBoundingClientRect()
    const cx      = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const pts     = chart.points
    const closest = pts.reduce((best, p) =>
      Math.abs(p.x - cx) < Math.abs(best.x - cx) ? p : best, pts[0])

    if (Math.abs(closest.x - cx) < 60) {
      if (lastIdxRef.current === closest.index) return
      lastIdxRef.current = closest.index
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() =>
        setTooltip({ x: closest.x, y: closest.y, data: closest.originalData, value: closest.value, index: closest.index })
      )
    } else {
      lastIdxRef.current = null
      setTooltip(null)
    }
  }, [chart.points])

  const handleLeave = useCallback(() => {
    lastIdxRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setTooltip(null)
  }, [])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!data || data.length === 0) {
    return (
      <div className="pnl-container" ref={containerRef}>
        <div className="pnl-empty">
          <span className="material-icons">show_chart</span>
          <p>No trade data yet</p>
        </div>
      </div>
    )
  }

  const { points, peaks, allMarkers, xLabels, yLines, dw, cw, ch } = chart
  const last  = points[points.length - 1]
  const first = points[0]
  const up    = last && first ? last.value >= first.value : true
  const lc    = up ? '#10b981' : '#ef4444'
  const gc    = up ? '#10b981' : '#ef4444'

  const activeMarker = allMarkers[navIdx] ?? null
  const baseline     = M.top + ch
  const chartRight   = M.left + cw   // full right edge of chart area

  // ── Tooltip position ──────────────────────────────────────────────────────
  let ttStyle = {}, arrowClass = ''
  if (tooltip && dim.width) {
    const TW      = isMobile ? 165 : 198
    const chartMY = M.top + ch / 2
    const below   = tooltip.y < chartMY

    let left = tooltip.x - TW / 2
    if (left < M.left)             left = M.left
    if (left + TW > dim.width - M.right) left = dim.width - M.right - TW

    const top   = below ? tooltip.y + 20 : tooltip.y - 20
    ttStyle     = { left, top, width: TW, ...(below ? {} : { transform: 'translateY(-100%)' }) }
    arrowClass  = below ? 'arrow-up' : 'arrow-down'
  }

  // ── Balance pin layout (right side) ───────────────────────────────────────
  const pinX       = last ? last.x + 14 : 0
  const pinW       = chartRight - pinX - 6
  const showPin    = last && pinW > 54   // only show if enough space

  return (
    <div className="pnl-container" ref={containerRef}>

      {/* ── Header ── */}
      <div className="pnl-header">
        <div className="pnl-header-left">
          <h3 className="pnl-title">{title}</h3>
          <p className="pnl-subtitle">Account balance over time</p>
        </div>

        <div className="pnl-header-right">
          {last && (
            <div className="pnl-balance-badge">
              <span className="pnl-balance-label">Balance</span>
              <span className="pnl-balance-value" style={{ color: lc }}>
                {formatCurrency(last.value)}
              </span>
              <span className="pnl-balance-change" style={{ color: lc }}>
                {up ? '▲' : '▼'} {formatCurrency(Math.abs(last.value - first.value))}
              </span>
            </div>
          )}

        </div>
      </div>

      {/* ── Chart ── */}
      <div className="pnl-chart-wrap" style={{ height: dim.height || 370 }}>
        {dim.width > 0 && (
          <svg
            ref={svgRef}
            width={dim.width}
            height={dim.height}
            className="pnl-svg"
            style={{ overflow: 'visible' }}
            onMouseMove={handlePointer}
            onMouseLeave={handleLeave}
            onTouchMove={e => { e.preventDefault(); handlePointer(e) }}
            onTouchEnd={handleLeave}
          >
            <defs>
              <linearGradient id="pnlAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={gc} stopOpacity="0.22" />
                <stop offset="65%"  stopColor={gc} stopOpacity="0.05" />
                <stop offset="100%" stopColor={gc} stopOpacity="0" />
              </linearGradient>
              {/* Clip to data area only */}
              <clipPath id="pnlDataClip">
                <rect x={M.left - 1} y={M.top - 1} width={dw + 2} height={ch + 2} />
              </clipPath>
            </defs>

            {/* ── Y grid lines (full chart width) ── */}
            {yLines.map((g, i) => (
              <g key={i}>
                <line
                  x1={M.left} y1={g.y} x2={chartRight} y2={g.y}
                  stroke="currentColor" strokeWidth="1" strokeDasharray="3 4"
                  className="pnl-grid-line"
                />
                <text x={M.left - 8} y={g.y + 4} className="pnl-axis-text" textAnchor="end">
                  {formatCurrency(g.value)}
                </text>
              </g>
            ))}

            {/* ── Area fill + line (clipped to data area) ── */}
            <g clipPath="url(#pnlDataClip)">
              <path d={areaPath(points, baseline)} fill="url(#pnlAreaGrad)" />
              <path
                d={smoothPath(points, 0.4)}
                fill="none" stroke={lc} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </g>

            {/* ── Future space: dashed "current level" line ── */}
            {last && (
              <line
                x1={last.x} y1={last.y}
                x2={chartRight} y2={last.y}
                stroke={lc} strokeWidth="1.5"
                strokeDasharray="5 4" strokeOpacity="0.35"
              />
            )}

            {/* ── Current balance pin in future space ── */}
            {showPin && last && (
              <g pointerEvents="none">
                {/* small dot at the start of the dashed line */}
                <circle cx={last.x} cy={last.y} r="4"
                  fill={lc} stroke="var(--bg-secondary)" strokeWidth="2" />
                {/* balance label box */}
                <rect
                  x={pinX} y={last.y - 12}
                  width={Math.min(pinW, 88)} height={24} rx="5"
                  fill={lc} fillOpacity="0.15"
                  stroke={lc} strokeWidth="1" strokeOpacity="0.4"
                />
                <text
                  x={pinX + Math.min(pinW, 88) / 2}
                  y={last.y + 4}
                  fill={lc} fontSize="10" fontWeight="700"
                  textAnchor="middle"
                  fontFamily="Inter, -apple-system, sans-serif"
                >
                  {formatCurrency(last.value)}
                </text>
              </g>
            )}

            {/* ── Data dots ── */}
            {points.map((pt, i) => {
              const isHovered = tooltip?.index === i
              return (
                <circle
                  key={`dot-${i}`}
                  cx={pt.x} cy={pt.y}
                  r={isHovered ? 5 : 2.5}
                  fill={isHovered ? lc : 'var(--bg-secondary)'}
                  stroke={lc}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isHovered ? 1 : 0.55}
                  pointerEvents="none"
                />
              )
            })}

            {/* ── PEAK markers + labels ── */}
            {peaks.map(pk => {
              const isActive = activeMarker?.index === pk.index && activeMarker?.type === 'peak'
              const LW = 82, LH = 32, DOT_R = isActive ? 6 : 5, GAP = 8
              // Prefer label above the dot; flip below if not enough room
              const spaceAbove = pk.y - M.top
              const above = spaceAbove >= LH + GAP + DOT_R + 2
              const lx = Math.max(M.left + 2, Math.min(pk.x - LW / 2, chartRight - LW - 2))
              const ly = above
                ? pk.y - DOT_R - GAP - LH
                : pk.y + DOT_R + GAP
              const tickY1 = above ? pk.y - DOT_R - 1  : pk.y + DOT_R + 1
              const tickY2 = above ? ly + LH + 1        : ly - 1

              return (
                <g key={`pk-${pk.index}`} pointerEvents="none" opacity={isActive ? 1 : 0.82}>
                  {/* active glow ring */}
                  {isActive && (
                    <circle cx={pk.x} cy={pk.y} r="13"
                      fill="#fbbf24" fillOpacity="0.13"
                      stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.4" />
                  )}
                  {/* dot */}
                  <circle cx={pk.x} cy={pk.y} r={DOT_R}
                    fill="#fbbf24" stroke="var(--bg-secondary)" strokeWidth={isActive ? 2.5 : 2} />
                  {/* tick connecting dot to label */}
                  <line x1={pk.x} y1={tickY1} x2={pk.x} y2={tickY2}
                    stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.55" />
                  {/* pill background */}
                  <rect x={lx} y={ly} width={LW} height={LH} rx={6}
                    fill="#fbbf24" fillOpacity={isActive ? 0.22 : 0.15}
                    stroke="#fbbf24" strokeWidth="1.2" strokeOpacity={isActive ? 0.9 : 0.6} />
                  {/* ▲ PEAK */}
                  <text x={lx + LW / 2} y={ly + 11}
                    fill="#fbbf24" fontSize="8.5" fontWeight="800"
                    textAnchor="middle" letterSpacing="0.1em"
                    fontFamily="Inter, -apple-system, sans-serif">
                    ▲ PEAK
                  </text>
                  {/* value */}
                  <text x={lx + LW / 2} y={ly + 25}
                    fill="#fbbf24" fontSize="10.5" fontWeight="700"
                    textAnchor="middle"
                    fontFamily="Inter, -apple-system, sans-serif">
                    {formatCurrency(pk.value)}
                  </text>
                </g>
              )
            })}


            {/* ── Hover crosshair ── */}
            {tooltip && (
              <g pointerEvents="none">
                <line
                  x1={tooltip.x} y1={M.top}
                  x2={tooltip.x} y2={baseline}
                  stroke={lc} strokeWidth="1.5"
                  strokeDasharray="4 3" opacity="0.4"
                />
                <circle
                  cx={tooltip.x} cy={tooltip.y}
                  r="5.5" fill={lc}
                  stroke="var(--bg-secondary)" strokeWidth="2.5"
                />
              </g>
            )}

            {/* ── X-axis labels ── */}
            {xLabels.map((pt, i) => {
              const isToday = pt.index === points.length - 1
              return (
                <g key={`xl-${i}`}>
                  {isToday && (
                    <rect
                      x={pt.x - 22} y={dim.height - M.bottom + 6}
                      width={44} height={16} rx={4}
                      fill={lc} fillOpacity="0.12"
                    />
                  )}
                  <text
                    x={pt.x} y={dim.height - M.bottom + 18}
                    className="pnl-axis-text" textAnchor="middle"
                    fill={isToday ? lc : undefined}
                    fontWeight={isToday ? '600' : undefined}
                  >
                    {pt.date}
                  </text>
                </g>
              )
            })}

            {/* ── Baseline ── */}
            <line
              x1={M.left} y1={baseline} x2={chartRight} y2={baseline}
              stroke="currentColor" className="pnl-axis-line"
            />

            {/* ── Left Y-axis border ── */}
            <line
              x1={M.left} y1={M.top} x2={M.left} y2={baseline}
              stroke="currentColor" className="pnl-axis-line"
            />
          </svg>
        )}

        {/* ── Floating tooltip ── */}
        {tooltip && dim.width > 0 && (
          <div className={`pnl-tooltip ${arrowClass}`} style={ttStyle}>
            <div className="pnl-tt-header">
              <span className="material-icons pnl-tt-icon">event</span>
              {tooltip.data.date}
            </div>
            <div className="pnl-tt-rows">
              <div className="pnl-tt-row">
                <span>Balance</span>
                <span style={{ color: lc }}>{formatCurrency(tooltip.value)}</span>
              </div>
              {tooltip.data.pnl !== undefined && (
                <div className="pnl-tt-row">
                  <span>Daily P&L</span>
                  <span className={tooltip.data.pnl >= 0 ? 'pos' : 'neg'}>
                    {formatCurrency(tooltip.data.pnl)}
                  </span>
                </div>
              )}
              {tooltip.data.cumulativePnL !== undefined && (
                <div className="pnl-tt-row">
                  <span>Cumulative</span>
                  <span className={tooltip.data.cumulativePnL >= 0 ? 'pos' : 'neg'}>
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

export default CumulativePnLChart
