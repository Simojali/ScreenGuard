import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ipc, onDayChanged } from '../lib/ipcClient'
import { dateToISO } from '../lib/dateUtils'
import { friendlyName } from '../lib/appNames'
import { CATEGORIES, resolveCategoryId, resolveLabel } from '../lib/categories'
import { useAppStore } from '../store/appStore'
import { useAppIcons } from '../hooks/useAppIcons'
import { useLimits } from '../hooks/useLimits'
import type { WeeklyReport, DailyTotal, AppLimit } from '../types'

const APP_COLORS = ['#7c8cf8', '#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#fb7185']
const MAX_CHART_APPS = 5

type ViewMode = 'apps' | 'categories'
type ChartEntry = { date: string; dayLabel: string; [key: string]: string | number }

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
  const color = APP_COLORS[name.charCodeAt(0) % APP_COLORS.length]
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

export default function DashboardPage(): React.ReactElement {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('apps')

  const currentApp = useAppStore((s) => s.currentApp)
  const isIdle = useAppStore((s) => s.isIdle)
  const liveTotals = useAppStore((s) => s.todayTotals)
  const theme = useAppStore((s) => s.theme)
  const categoryOverrides = useAppStore((s) => s.categoryOverrides)
  const categoryLabels = useAppStore((s) => s.categoryLabels)
  const resetTodayTotals = useAppStore((s) => s.resetTodayTotals)
  const { limits } = useLimits()

  // 'today' is kept as state so it updates when the calendar day changes
  const [today, setToday] = useState<string>(() => dateToISO(new Date()))

  // ── Day rollover ────────────────────────────────────────────────────────────
  // 1. Listen for the main-process 'tracker:day-changed' event (fires right at midnight)
  // 2. Poll every 30 s as a fallback (cheap string compare)
  useEffect(() => {
    function handleNewDay(): void {
      const newDay = dateToISO(new Date())
      setToday(newDay)
      resetTodayTotals()
      setWeekStart(mondayOf(new Date()))
    }
    const unsub = onDayChanged(handleNewDay)
    const timer = setInterval(() => {
      const newDay = dateToISO(new Date())
      setToday((prev) => {
        if (prev !== newDay) {
          resetTodayTotals()
          setWeekStart(mondayOf(new Date()))
          return newDay
        }
        return prev
      })
    }, 30_000)
    return () => { unsub(); clearInterval(timer) }
  }, [resetTodayTotals])

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

  const displayList = useMemo<DailyTotal[]>(() => {
    if (selectedDay) {
      return [...(report?.byDate[selectedDay] ?? [])].sort((a, b) => b.total_ms - a.total_ms)
    }
    return weeklyTotals
  }, [selectedDay, report, weeklyTotals])

  const totalMs = displayList.reduce((s, t) => s + t.total_ms, 0)

  // Apps chart
  const topApps = weeklyTotals.slice(0, MAX_CHART_APPS).map((t) => t.app_name)
  const hasOtherApps = weeklyTotals.length > MAX_CHART_APPS

  const appsChartData = useMemo<ChartEntry[]>(() => {
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

  // Categories chart
  const catChartData = useMemo<ChartEntry[]>(() => {
    if (!report?.dates) return []
    return report.dates.map((date) => {
      const dayTotals = report.byDate[date] ?? []
      const dayLabel = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(date + 'T12:00:00').getDay()]
      const entry: ChartEntry = { date, dayLabel }
      for (const t of dayTotals) {
        const catId = resolveCategoryId(t.app_name, categoryOverrides)
        entry[catId] = ((entry[catId] as number) || 0) + Math.round(t.total_ms / 60000)
      }
      return entry
    })
  }, [report, categoryOverrides])

  const activeCats = useMemo(
    () => CATEGORIES.filter((cat) => catChartData.some((e) => (e[cat.id] as number) > 0)),
    [catChartData]
  )

  const categoryTotals = useMemo(() => {
    const m: Record<string, { totalMs: number; appCount: number }> = {}
    for (const t of displayList) {
      const catId = resolveCategoryId(t.app_name, categoryOverrides)
      if (!m[catId]) m[catId] = { totalMs: 0, appCount: 0 }
      m[catId].totalMs += t.total_ms
      m[catId].appCount++
    }
    return CATEGORIES
      .map((cat) => ({
        ...cat,
        label: resolveLabel(cat.id, categoryLabels),
        totalMs: m[cat.id]?.totalMs ?? 0,
        appCount: m[cat.id]?.appCount ?? 0,
      }))
      .filter((c) => c.totalMs > 0)
      .sort((a, b) => b.totalMs - a.totalMs)
  }, [displayList, categoryOverrides, categoryLabels])

  const activeChartData = viewMode === 'categories' ? catChartData : appsChartData
  const icons = useAppIcons(displayList.map((t) => t.exe_path).filter(Boolean))

  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
  const isCurrentWeek = report?.dates?.includes(today) ?? false

  // Average daily usage: total week ms / days that have any data
  const avgDailyMs = useMemo(() => {
    if (!report?.dates) return 0
    const daysWithData = report.dates.filter((d) => (report.byDate[d] ?? []).length > 0)
    if (daysWithData.length === 0) return 0
    const weekTotal = daysWithData.reduce((sum, d) =>
      sum + (report.byDate[d] ?? []).reduce((s, t) => s + t.total_ms, 0), 0)
    return Math.round(weekTotal / daysWithData.length)
  }, [report])

  // Today's total: start from all apps in the DB report, then overlay live
  // values (taking the max to handle the 30s flush lag). This prevents the
  // bug where liveTotals only contains apps active *after* ScreenGuard opened.
  const todayMs = useMemo(() => {
    const merged: Record<string, number> = {}
    for (const t of (report?.byDate[today] ?? [])) {
      merged[t.app_name] = t.total_ms
    }
    for (const [app, ms] of Object.entries(liveTotals)) {
      merged[app] = Math.max(merged[app] ?? 0, ms)
    }
    return Object.values(merged).reduce((s, ms) => s + ms, 0)
  }, [liveTotals, report, today])

  // Theme-aware chart tooltip colors
  const isDark = theme === 'dark'
  const ttBg     = isDark ? '#1e2133' : '#ffffff'
  const ttBorder = isDark ? '#374162' : '#c9d1e3'

  const navBtn: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text-3)', cursor: 'pointer', padding: '4px 8px',
    display: 'flex', alignItems: 'center',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: active ? 600 : 400,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-3)',
    cursor: 'pointer', border: 'none',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-end', gap: 28 }}>
        {/* Average daily */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Average Daily Usage
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-2px', lineHeight: 1 }}>
            {avgDailyMs > 0 ? formatDuration(avgDailyMs) : '—'}
          </div>
        </div>

        {/* Divider */}
        {isCurrentWeek && (
          <>
            <div style={{ width: 1, height: 44, background: 'var(--border)', flexShrink: 0 }} />
            {/* Today */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                Today
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-2px', lineHeight: 1 }}>
                {todayMs > 0 ? formatDuration(todayMs) : '—'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button style={navBtn} onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 140, textAlign: 'center' }}>
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
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 14px 10px', marginBottom: 14, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height={148}>
          <BarChart
            data={activeChartData}
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
              dataKey="dayLabel" axisLine={false} tickLine={false}
              tick={(props: { x: number; y: number; payload: { value: string }; index: number }) => {
                const date = activeChartData[props.index]?.date
                const isSelected = date === selectedDay
                const isToday = date === today
                const fill = isSelected ? 'var(--accent)' : isToday ? (isDark ? '#c7d2fe' : '#6366f1') : 'var(--text-4)'
                return (
                  <text x={props.x} y={props.y + 13} textAnchor="middle"
                    fill={fill} fontSize={11} fontWeight={isSelected || isToday ? 700 : 400}
                  >
                    {props.payload.value}
                  </text>
                )
              }}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: ttBg, border: `1px solid ${ttBorder}`, borderRadius: 8, fontSize: 12 }}
              labelFormatter={(_, payload) => {
                const date = (payload?.[0]?.payload as ChartEntry)?.date
                return date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
              }}
              formatter={(v: number, name: string) => {
                if (viewMode === 'categories') {
                  const cat = CATEGORIES.find((c) => c.id === name)
                  const label = cat ? resolveLabel(cat.id, categoryLabels) : name
                  return [formatDuration(v * 60000), cat ? `${cat.icon} ${label}` : name]
                }
                return [formatDuration(v * 60000), name === '__other__' ? 'Other' : friendlyName(name)]
              }}
            />

            {viewMode === 'apps' && topApps.map((app, i) => (
              <Bar key={app} dataKey={app} stackId="s" fill={APP_COLORS[i % APP_COLORS.length]}
                radius={!hasOtherApps && i === topApps.length - 1 ? [3, 3, 0, 0] : undefined}
              >
                {appsChartData.map((entry, j) => (
                  <Cell key={j} fill={APP_COLORS[i % APP_COLORS.length]}
                    opacity={selectedDay && entry.date !== selectedDay ? 0.2 : 1}
                  />
                ))}
              </Bar>
            ))}
            {viewMode === 'apps' && hasOtherApps && (
              <Bar dataKey="__other__" stackId="s" fill="var(--text-4)" radius={[3, 3, 0, 0]}>
                {appsChartData.map((entry, j) => (
                  <Cell key={j} fill={isDark ? '#475569' : '#9ca3af'} opacity={selectedDay && entry.date !== selectedDay ? 0.2 : 1} />
                ))}
              </Bar>
            )}

            {viewMode === 'categories' && activeCats.map((cat, i) => (
              <Bar key={cat.id} dataKey={cat.id} stackId="s" fill={cat.color}
                radius={i === activeCats.length - 1 ? [3, 3, 0, 0] : undefined}
              >
                {catChartData.map((entry, j) => (
                  <Cell key={j} fill={cat.color} opacity={selectedDay && entry.date !== selectedDay ? 0.2 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {viewMode === 'apps' ? (
            <>
              {topApps.map((app, i) => (
                <div key={app} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: APP_COLORS[i % APP_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{friendlyName(app)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{formatDuration(weeklyByApp[app]?.total_ms ?? 0)}</span>
                </div>
              ))}
              {hasOtherApps && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--text-4)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Other</span>
                </div>
              )}
            </>
          ) : (
            activeCats.map((cat) => {
              const total = categoryTotals.find((c) => c.id === cat.id)?.totalMs ?? 0
              return (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{resolveLabel(cat.id, categoryLabels)}</span>
                  {total > 0 && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{formatDuration(total)}</span>}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* List header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-4)', marginRight: 2 }}>Show:</span>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, display: 'flex', gap: 2 }}>
            <button style={tabStyle(viewMode === 'apps')} onClick={() => setViewMode('apps')}>Apps</button>
            <button style={tabStyle(viewMode === 'categories')} onClick={() => setViewMode('categories')}>Categories</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--border-hi)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</span>
          {viewMode === 'apps' && (
            <span style={{ fontSize: 11, color: 'var(--border-hi)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 58 }}>Limit</span>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* APPS */}
        {viewMode === 'apps' && (
          displayList.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '32px 0', fontSize: 13 }}>
              No usage data{selectedDay ? ' for this day' : ' this week'}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {displayList.map((total, idx) => {
                const limit = limitMap[total.app_name]
                const overLimit = !!(limit?.is_enabled && total.total_ms >= limit.limit_ms)
                const isActive = total.app_name === currentApp
                const icon = icons[total.exe_path]
                return (
                  <div key={total.app_name} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                    borderBottom: idx < displayList.length - 1 ? '1px solid var(--bg-row)' : 'none',
                    background: isActive ? 'var(--accent-sub)' : 'transparent',
                  }}>
                    {icon
                      ? <img src={icon} width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} alt="" />
                      : <LetterIcon name={total.app_name} size={28} />
                    }
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isActive && !isIdle && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e', flexShrink: 0 }} />}
                      {isActive && isIdle && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-4)', flexShrink: 0 }} />}
                      <span style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {friendlyName(total.app_name)}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', minWidth: 55, textAlign: 'right', flexShrink: 0 }}>
                      {formatDuration(total.total_ms)}
                    </span>
                    <div style={{ minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
                      {limit ? (
                        <span style={{
                          fontSize: 11, padding: '2px 7px', borderRadius: 10,
                          background: overLimit ? 'rgba(239,68,68,0.12)' : 'var(--accent-sub)',
                          color: overLimit ? '#ef4444' : 'var(--accent)',
                        }}>
                          {overLimit ? 'Limit hit' : `/ ${formatDuration(limit.limit_ms)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* CATEGORIES */}
        {viewMode === 'categories' && (
          categoryTotals.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '32px 0', fontSize: 13 }}>
              No usage data{selectedDay ? ' for this day' : ' this week'}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {categoryTotals.map((cat, idx) => (
                <div key={cat.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: idx < categoryTotals.length - 1 ? '1px solid var(--bg-row)' : 'none',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: cat.color + '22', border: `1.5px solid ${cat.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                  }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
                      {cat.appCount} {cat.appCount === 1 ? 'app' : 'apps'}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', minWidth: 55, textAlign: 'right', flexShrink: 0 }}>
                    {formatDuration(cat.totalMs)}
                  </span>
                  <div style={{ width: 3, height: 28, borderRadius: 2, background: cat.color, flexShrink: 0, opacity: 0.7 }} />
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
