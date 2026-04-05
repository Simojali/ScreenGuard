import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ipc } from '../lib/ipcClient'
import { dateToISO } from '../lib/dateUtils'
import { friendlyName } from '../lib/appNames'
import { useAppStore } from '../store/appStore'
import { useAppIcons } from '../hooks/useAppIcons'
import { useLimits } from '../hooks/useLimits'
import type { WeeklyReport, DailyTotal, AppLimit } from '../types'

const COLORS = ['#7c8cf8', '#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#fb7185']
const MAX_CHART_APPS = 5

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return '0m'
}

function LetterIcon({ name, size = 28 }: { name: string; size?: number }): React.ReactElement {
  const color = COLORS[name.charCodeAt(0) % COLORS.length]
  const letter = name.replace(/\.exe$/i, '').charAt(0).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.22),
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.45), fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {letter}
    </div>
  )
}

type ChartEntry = { date: string; dayLabel: string; [key: string]: string | number }

export default function DashboardPage(): React.ReactElement {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const currentApp = useAppStore((s) => s.currentApp)
  const liveTotals = useAppStore((s) => s.todayTotals)
  const { limits } = useLimits()

  const today = dateToISO(new Date())

  useEffect(() => {
    ipc.getWeekly(dateToISO(weekStart)).then((r) => {
      setReport(r)
      setSelectedDay(null)
    })
  }, [weekStart])

  const limitMap = useMemo<Record<string, AppLimit>>(() => {
    const m: Record<string, AppLimit> = {}
    for (const l of limits) m[l.app_name] = l
    return m
  }, [limits])

  // Aggregate per-app weekly totals, applying live values for today
  const weeklyByApp = useMemo<Record<string, DailyTotal>>(() => {
    if (!report) return {}
    const m: Record<string, DailyTotal> = {}
    for (const date of (report.dates ?? [])) {
      for (const t of (report.byDate[date] ?? [])) {
        if (!m[t.app_name]) m[t.app_name] = { ...t, date: 'week', total_ms: 0 }
        m[t.app_name].total_ms += t.total_ms
      }
    }
    if (report.dates?.includes(today)) {
      for (const [app, ms] of Object.entries(liveTotals)) {
        if (m[app]) m[app].total_ms = Math.max(m[app].total_ms, ms)
      }
    }
    return m
  }, [report, liveTotals, today])

  const weeklyTotals = useMemo(
    () => Object.values(weeklyByApp).sort((a, b) => b.total_ms - a.total_ms),
    [weeklyByApp]
  )

  // App list: selected day or full week
  const displayList = useMemo<DailyTotal[]>(() => {
    if (selectedDay) {
      return [...(report?.byDate[selectedDay] ?? [])].sort((a, b) => b.total_ms - a.total_ms)
    }
    return weeklyTotals
  }, [selectedDay, report, weeklyTotals])

  const totalMs = displayList.reduce((s, t) => s + t.total_ms, 0)

  // Top apps for stacked chart
  const topApps = weeklyTotals.slice(0, MAX_CHART_APPS).map((t) => t.app_name)
  const hasOther = weeklyTotals.length > MAX_CHART_APPS

  const chartData = useMemo<ChartEntry[]>(() => {
    if (!report?.dates) return []
    return report.dates.map((date) => {
      const dayTotals = report.byDate[date] ?? []
      const dayLabel = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(date + 'T12:00:00').getDay()]
      const entry: ChartEntry = { date, dayLabel }
      let otherMs = 0
      for (const t of dayTotals) {
        if (topApps.includes(t.app_name)) {
          entry[t.app_name] = ((entry[t.app_name] as number) || 0) + Math.round(t.total_ms / 60000)
        } else {
          otherMs += t.total_ms
        }
      }
      if (otherMs > 0) entry['__other__'] = Math.round(otherMs / 60000)
      return entry
    })
  }, [report, topApps])

  const icons = useAppIcons(displayList.map((t) => t.exe_path).filter(Boolean))

  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
  const isCurrentWeek = report?.dates?.includes(today) ?? false

  const navBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #2d3148', borderRadius: 6,
    color: '#64748b', cursor: 'pointer', padding: '4px 8px',
    display: 'flex', alignItems: 'center',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header: label + big total */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          {selectedDay
            ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : 'Daily Usage'}
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-2px', lineHeight: 1 }}>
          {totalMs > 0 ? formatDuration(totalMs) : '—'}
        </div>
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button style={navBtn} onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 12, color: '#64748b', minWidth: 140, textAlign: 'center' }}>
          {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' – '}
          {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <button style={navBtn} onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}>
          <ChevronRight size={14} />
        </button>
        {!isCurrentWeek && (
          <button style={{ ...navBtn, padding: '4px 10px', fontSize: 12 }} onClick={() => setWeekStart(mondayOf(new Date()))}>
            Today
          </button>
        )}
        {selectedDay && (
          <button style={{ ...navBtn, padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={() => setSelectedDay(null)}>
            Show week
          </button>
        )}
      </div>

      {/* Chart card */}
      <div style={{ background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 12, padding: '14px 14px 10px', marginBottom: 14, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height={148}>
          <BarChart
            data={chartData}
            barCategoryGap="32%"
            onClick={(e) => {
              if (e?.activePayload?.length) {
                const date = (e.activePayload[0]?.payload as ChartEntry)?.date
                if (date) setSelectedDay((prev) => (prev === date ? null : date))
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <XAxis
              dataKey="dayLabel"
              axisLine={false}
              tickLine={false}
              tick={(props: { x: number; y: number; payload: { value: string }; index: number }) => {
                const date = chartData[props.index]?.date
                const isSelected = date === selectedDay
                const isToday = date === today
                return (
                  <text
                    x={props.x} y={props.y + 13}
                    textAnchor="middle"
                    fill={isSelected ? '#7c8cf8' : isToday ? '#c7d2fe' : '#475569'}
                    fontSize={11}
                    fontWeight={isSelected || isToday ? 700 : 400}
                  >
                    {props.payload.value}
                  </text>
                )
              }}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#1e2133', border: '1px solid #2d3148', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(_, payload) => {
                const date = (payload?.[0]?.payload as ChartEntry)?.date
                return date
                  ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : ''
              }}
              formatter={(v: number, name: string) => [
                formatDuration(v * 60000),
                name === '__other__' ? 'Other' : friendlyName(name),
              ]}
            />
            {topApps.map((app, i) => (
              <Bar
                key={app}
                dataKey={app}
                stackId="s"
                fill={COLORS[i % COLORS.length]}
                radius={!hasOther && i === topApps.length - 1 ? [3, 3, 0, 0] : undefined}
              >
                {chartData.map((entry, j) => (
                  <Cell
                    key={j}
                    fill={COLORS[i % COLORS.length]}
                    opacity={selectedDay && entry.date !== selectedDay ? 0.2 : 1}
                  />
                ))}
              </Bar>
            ))}
            {hasOther && (
              <Bar dataKey="__other__" stackId="s" fill="#475569" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, j) => (
                  <Cell key={j} fill="#475569" opacity={selectedDay && entry.date !== selectedDay ? 0.2 : 1} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        {topApps.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', paddingTop: 10, borderTop: '1px solid #2d3148' }}>
            {topApps.map((app, i) => (
              <div key={app} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#64748b' }}>{friendlyName(app)}</span>
                <span style={{ fontSize: 11, color: '#475569' }}>{formatDuration(weeklyByApp[app]?.total_ms ?? 0)}</span>
              </div>
            ))}
            {hasOther && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#475569', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#64748b' }}>Other</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* List header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8, flexShrink: 0 }}>
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 8, padding: 3 }}>
          <span style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: 6,
            background: '#7c8cf8', color: '#fff', fontSize: 12, fontWeight: 600,
          }}>
            Apps
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 11, color: '#374162', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</span>
          <span style={{ fontSize: 11, color: '#374162', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 58 }}>Limit</span>
        </div>
      </div>

      {/* App list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayList.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '32px 0', fontSize: 13 }}>
            No usage data{selectedDay ? ' for this day' : ' this week'}
          </div>
        ) : (
          <div style={{ background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 12, overflow: 'hidden' }}>
            {displayList.map((total, idx) => {
              const limit = limitMap[total.app_name]
              const overLimit = !!(limit?.is_enabled && total.total_ms >= limit.limit_ms)
              const isActive = total.app_name === currentApp
              const icon = icons[total.exe_path]
              return (
                <div
                  key={total.app_name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                    borderBottom: idx < displayList.length - 1 ? '1px solid #1e2133' : 'none',
                    background: isActive ? 'rgba(124,140,248,0.05)' : 'transparent',
                  }}
                >
                  {icon
                    ? <img src={icon} width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} alt="" />
                    : <LetterIcon name={total.app_name} size={28} />
                  }
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isActive && (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
                        boxShadow: '0 0 5px #22c55e', flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontSize: 14, color: '#e2e8f0', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {friendlyName(total.app_name)}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 13, color: '#94a3b8', fontVariantNumeric: 'tabular-nums',
                    minWidth: 55, textAlign: 'right', flexShrink: 0,
                  }}>
                    {formatDuration(total.total_ms)}
                  </span>
                  <div style={{ minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
                    {limit ? (
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 10,
                        background: overLimit ? 'rgba(239,68,68,0.12)' : 'rgba(124,140,248,0.08)',
                        color: overLimit ? '#ef4444' : '#7c8cf8',
                      }}>
                        {overLimit ? 'Limit hit' : `/ ${formatDuration(limit.limit_ms)}`}
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
