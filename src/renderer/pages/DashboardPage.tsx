import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
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
type ViewScope = 'today' | 'week' | 'month'
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
  // Default to today so the list shows today's apps on first load
  const [selectedDay, setSelectedDay] = useState<string | null>(() => dateToISO(new Date()))
  const [viewMode, setViewMode] = useState<ViewMode>('apps')
  const [viewScope, setViewScope] = useState<ViewScope>('today')
  const [monthlyTotals, setMonthlyTotals] = useState<DailyTotal[]>([])
  // Custom date range picker
  const [showPicker, setShowPicker] = useState(false)
  const [pickerStart, setPickerStart] = useState(() => dateToISO(mondayOf(new Date())))
  const [pickerEnd, setPickerEnd] = useState(() => dateToISO(new Date()))
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null)
  const [customTotals, setCustomTotals] = useState<DailyTotal[]>([])
  const [customByDate, setCustomByDate] = useState<Record<string, DailyTotal[]>>({})
  const [monthlyByDate, setMonthlyByDate] = useState<Record<string, DailyTotal[]>>({})

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

  // ── Fetch monthly data whenever the scope switches to 'month' ──────────────
  // Reuses the existing getWeekly call (guaranteed to work) by fetching every
  // Monday-week that overlaps the current month, then aggregating per-app totals
  // while filtering out any days that fall outside the month boundary.
  useEffect(() => {
    if (viewScope !== 'month') return

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const monthStartISO = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const monthEndISO = dateToISO(now)

    // Walk Monday-aligned weeks from the one containing the 1st to today's week
    const weekStarts: string[] = []
    let cursor = mondayOf(new Date(year, month, 1))
    while (dateToISO(cursor) <= monthEndISO) {
      weekStarts.push(dateToISO(new Date(cursor)))
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
    }

    Promise.all(weekStarts.map((ws) => ipc.getWeekly(ws))).then((reports) => {
      const merged: Record<string, DailyTotal> = {}
      const byDate: Record<string, DailyTotal[]> = {}
      for (const rep of reports) {
        for (const date of (rep.dates ?? [])) {
          if (date < monthStartISO || date > monthEndISO) continue
          byDate[date] = rep.byDate[date] ?? []
          for (const t of (rep.byDate[date] ?? [])) {
            if (!merged[t.app_name]) merged[t.app_name] = { ...t, date: 'month', total_ms: 0 }
            merged[t.app_name].total_ms += t.total_ms
          }
        }
      }
      for (const [app, ms] of Object.entries(liveTotals)) {
        if (merged[app]) merged[app].total_ms = Math.max(merged[app].total_ms, ms)
      }
      setMonthlyByDate(byDate)
      setMonthlyTotals(Object.values(merged).sort((a, b) => b.total_ms - a.total_ms))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScope])

  // ── Custom date range fetch ─────────────────────────────────────────────────
  async function applyCustomRange(start: string, end: string): Promise<void> {
    if (!start || !end || start > end) return
    setCustomRange({ start, end })
    setShowPicker(false)
    setSelectedDay(null)

    // Walk Monday-aligned weeks that overlap the range, fetch each, aggregate
    const weekStarts: string[] = []
    let cursor = mondayOf(new Date(start + 'T12:00:00'))
    while (dateToISO(cursor) <= end) {
      weekStarts.push(dateToISO(new Date(cursor)))
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
    }
    const reports = await Promise.all(weekStarts.map((ws) => ipc.getWeekly(ws)))
    const merged: Record<string, DailyTotal> = {}
    const byDate: Record<string, DailyTotal[]> = {}
    for (const rep of reports) {
      for (const date of (rep.dates ?? [])) {
        if (date < start || date > end) continue
        byDate[date] = rep.byDate[date] ?? []
        for (const t of (rep.byDate[date] ?? [])) {
          if (!merged[t.app_name]) merged[t.app_name] = { ...t, date: 'custom', total_ms: 0 }
          merged[t.app_name].total_ms += t.total_ms
        }
      }
    }
    setCustomByDate(byDate)
    setCustomTotals(Object.values(merged).sort((a, b) => b.total_ms - a.total_ms))
  }

  function clearCustomRange(): void {
    setCustomRange(null)
    setCustomTotals([])
    setCustomByDate({})
  }

  // ── Day rollover ────────────────────────────────────────────────────────────
  // 1. Listen for the main-process 'tracker:day-changed' event (fires right at midnight)
  // 2. Poll every 30 s as a fallback (cheap string compare)
  useEffect(() => {
    function handleNewDay(): void {
      const newDay = dateToISO(new Date())
      setToday(newDay)
      setSelectedDay(newDay)
      setViewScope('today')
      setMonthlyTotals([])
      setMonthlyByDate({})
      setCustomRange(null)
      setCustomTotals([])
      setCustomByDate({})
      resetTodayTotals()
      setWeekStart(mondayOf(new Date()))
    }
    const unsub = onDayChanged(handleNewDay)
    // Backup poll — uses a closure variable so no stale-state issues
    let lastKnownDay = dateToISO(new Date())
    const timer = setInterval(() => {
      const newDay = dateToISO(new Date())
      if (newDay !== lastKnownDay) {
        lastKnownDay = newDay
        handleNewDay()
      }
    }, 30_000)
    return () => { unsub(); clearInterval(timer) }
  }, [resetTodayTotals])

  useEffect(() => {
    ipc.getWeekly(dateToISO(weekStart)).then((r) => {
      setReport(r)
      // Current week → default to today; past/future weeks → show the whole week
      const dates = r.dates ?? []
      setSelectedDay(dates.includes(today) ? today : null)
    })
  }, [weekStart, today])

  // ── Periodic report refresh ─────────────────────────────────────────────────
  // Re-fetch the weekly DB snapshot every 30 s so that apps that ended a
  // session (were switched away from) show up-to-date totals.  The initial
  // fetch above already handles navigation; this keeps live data accurate.
  useEffect(() => {
    const timer = setInterval(() => {
      ipc.getWeekly(dateToISO(weekStart)).then((r) => setReport(r))
    }, 30_000)
    return () => clearInterval(timer)
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
    if (customRange) return customTotals

    // A specific day bar was clicked — show that day (overrides scope)
    if (selectedDay && selectedDay !== today) {
      return [...(report?.byDate[selectedDay] ?? [])].sort((a, b) => b.total_ms - a.total_ms)
    }

    if (viewScope === 'today' || selectedDay === today) {
      // Today: overlay live totals on DB rows so running apps are up to date
      const dbRows = report?.byDate[today] ?? []
      return [...dbRows]
        .map((t) => ({ ...t, total_ms: Math.max(t.total_ms, liveTotals[t.app_name] ?? 0) }))
        .sort((a, b) => b.total_ms - a.total_ms)
    }

    if (viewScope === 'month') return monthlyTotals

    return weeklyTotals  // 'week'
  }, [customRange, customTotals, selectedDay, viewScope, report, weeklyTotals, monthlyTotals, today, liveTotals])

  const totalMs = displayList.reduce((s, t) => s + t.total_ms, 0)

  const monthTotal = useMemo(
    () => monthlyTotals.reduce((s, t) => s + t.total_ms, 0),
    [monthlyTotals]
  )

  // ── Chart source: pick the right dates + byDate based on active scope ────────
  const chartDates = useMemo<string[]>(() => {
    if (customRange) {
      const dates: string[] = []
      const cursor = new Date(customRange.start + 'T12:00:00')
      const endD  = new Date(customRange.end   + 'T12:00:00')
      while (dateToISO(cursor) <= dateToISO(endD)) {
        dates.push(dateToISO(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
      return dates
    }
    if (viewScope === 'month') {
      const dates: string[] = []
      const now = new Date()
      const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
      while (dateToISO(cursor) <= dateToISO(now)) {
        dates.push(dateToISO(new Date(cursor)))
        cursor.setDate(cursor.getDate() + 1)
      }
      return dates
    }
    return report?.dates ?? []
  }, [customRange, viewScope, report])

  const chartByDate = useMemo<Record<string, DailyTotal[]>>(() => {
    if (customRange) return customByDate
    if (viewScope === 'month') return monthlyByDate
    return report?.byDate ?? {}
  }, [customRange, customByDate, viewScope, monthlyByDate, report])

  // Top apps driven by whichever totals are active
  const activeTotals = customRange ? customTotals : viewScope === 'month' ? monthlyTotals : weeklyTotals
  const topApps = activeTotals.slice(0, MAX_CHART_APPS).map((t) => t.app_name)
  const hasOtherApps = activeTotals.length > MAX_CHART_APPS

  // X-axis label: letter for ≤7 days, day-of-month number otherwise
  function dayLabel(date: string, totalDays: number): string {
    const d = new Date(date + 'T12:00:00')
    if (totalDays <= 7) return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]
    // For longer ranges only label the 1st and every 7th day to avoid crowding
    return d.getDate() % 7 === 1 || d.getDate() === 1 ? String(d.getDate()) : ''
  }

  const appsChartData = useMemo<ChartEntry[]>(() => {
    return chartDates.map((date) => {
      const dayTotals = chartByDate[date] ?? []
      const entry: ChartEntry = { date, dayLabel: dayLabel(date, chartDates.length) }
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
  }, [chartDates, chartByDate, topApps])

  // Categories chart
  const catChartData = useMemo<ChartEntry[]>(() => {
    return chartDates.map((date) => {
      const dayTotals = chartByDate[date] ?? []
      const entry: ChartEntry = { date, dayLabel: dayLabel(date, chartDates.length) }
      for (const t of dayTotals) {
        const catId = resolveCategoryId(t.app_name, categoryOverrides)
        entry[catId] = ((entry[catId] as number) || 0) + Math.round(t.total_ms / 60000)
      }
      return entry
    })
  }, [chartDates, chartByDate, categoryOverrides])

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
    // Custom range: total / number of days in range
    if (customRange && customTotals.length > 0) {
      const total = customTotals.reduce((s, t) => s + t.total_ms, 0)
      const days = Math.round(
        (new Date(customRange.end + 'T12:00:00').getTime() - new Date(customRange.start + 'T12:00:00').getTime()) / 86400000
      ) + 1
      return Math.round(total / Math.max(1, days))
    }
    // Month scope: average = month total / days elapsed so far this month
    if (viewScope === 'month' && monthlyTotals.length > 0) {
      const total = monthlyTotals.reduce((s, t) => s + t.total_ms, 0)
      const dayOfMonth = new Date().getDate()
      return Math.round(total / dayOfMonth)
    }
    // Week / day scope: average over days that have any data
    if (!report?.dates) return 0
    const daysWithData = report.dates.filter((d) => (report.byDate[d] ?? []).length > 0)
    if (daysWithData.length === 0) return 0
    const weekTotal = daysWithData.reduce((sum, d) =>
      sum + (report.byDate[d] ?? []).reduce((s, t) => s + t.total_ms, 0), 0)
    return Math.round(weekTotal / daysWithData.length)
  }, [customRange, customTotals, report, viewScope, monthlyTotals])

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
            {customRange ? 'Avg Daily (Range)' : viewScope === 'month' ? 'Avg Daily (Month)' : 'Average Daily Usage'}
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-2px', lineHeight: 1 }}>
            {avgDailyMs > 0 ? formatDuration(avgDailyMs) : '—'}
          </div>
        </div>

        {/* Divider + contextual total (custom range / selected day / today / month) */}
        {(() => {
          // Custom date range
          if (customRange) {
            const fmtD = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const label = `${fmtD(customRange.start)} – ${fmtD(customRange.end)}`
            const ms = customTotals.reduce((s, t) => s + t.total_ms, 0)
            return (
              <>
                <div style={{ width: 1, height: 44, background: 'var(--border)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-2px', lineHeight: 1 }}>{ms > 0 ? formatDuration(ms) : '—'}</div>
                </div>
              </>
            )
          }
          // A past day was clicked in the chart
          if (selectedDay && selectedDay !== today) {
            const label = new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            return (
              <>
                <div style={{ width: 1, height: 44, background: 'var(--border)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-2px', lineHeight: 1 }}>{totalMs > 0 ? formatDuration(totalMs) : '—'}</div>
                </div>
              </>
            )
          }
          // Today scope or today bar clicked
          if (viewScope === 'today' || selectedDay === today) {
            return (
              <>
                <div style={{ width: 1, height: 44, background: 'var(--border)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Today</div>
                  <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-2px', lineHeight: 1 }}>{todayMs > 0 ? formatDuration(todayMs) : '—'}</div>
                </div>
              </>
            )
          }
          // Month scope
          if (viewScope === 'month') {
            const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            return (
              <>
                <div style={{ width: 1, height: 44, background: 'var(--border)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{monthLabel}</div>
                  <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-2px', lineHeight: 1 }}>{monthTotal > 0 ? formatDuration(monthTotal) : '—'}</div>
                </div>
              </>
            )
          }
          return null  // week scope — only avg daily shown on the left
        })()}
      </div>

      {/* Week navigation + date range picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative' }}>
        {/* Prev/next arrows — hidden when a custom range is active */}
        {!customRange && (
          <button style={navBtn} onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}>
            <ChevronLeft size={14} />
          </button>
        )}

        {/* Clickable date label — opens the date range picker */}
        <button
          onClick={() => {
            if (!showPicker) {
              setPickerStart(customRange?.start ?? dateToISO(weekStart))
              setPickerEnd(customRange?.end ?? dateToISO(weekEnd) <= dateToISO(new Date()) ? customRange?.end ?? dateToISO(weekEnd) : dateToISO(new Date()))
            }
            setShowPicker((v) => !v)
          }}
          style={{ fontSize: 12, color: showPicker ? 'var(--accent)' : 'var(--text-3)', minWidth: 140, textAlign: 'center', background: showPicker ? 'var(--accent-sub)' : 'none', border: `1px solid ${showPicker ? 'var(--accent)' : 'transparent'}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          {customRange
            ? `${new Date(customRange.start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(customRange.end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          }
          <ChevronDown size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
        </button>

        {!customRange && (
          <button style={navBtn} onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}>
            <ChevronRight size={14} />
          </button>
        )}

        {/* Clear custom range */}
        {customRange && (
          <button style={{ ...navBtn, padding: '4px 10px', fontSize: 12 }} onClick={clearCustomRange}>
            ✕ Clear
          </button>
        )}

        {!isCurrentWeek && !customRange && (
          <button style={{ ...navBtn, padding: '4px 10px', fontSize: 12 }} onClick={() => setWeekStart(mondayOf(new Date()))}>
            This week
          </button>
        )}

        {/* Date range picker dropdown */}
        {showPicker && (() => {
          const now = new Date()
          const todayISO2 = dateToISO(now)

          // ── Preset ranges ────────────────────────────────────────────────
          function sub(days: number): string {
            const d = new Date(now); d.setDate(d.getDate() - days); return dateToISO(d)
          }
          function monthStart(offset = 0): string {
            const d = new Date(now.getFullYear(), now.getMonth() + offset, 1); return dateToISO(d)
          }
          function monthEnd(offset = 0): string {
            const d = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0); return dateToISO(d)
          }

          const presets: { label: string; start: string; end: string }[] = [
            { label: 'Today',        start: todayISO2,    end: todayISO2 },
            { label: 'Yesterday',    start: sub(1),       end: sub(1) },
            { label: 'Last 7 Days',  start: sub(6),       end: todayISO2 },
            { label: 'Last 30 Days', start: sub(29),      end: todayISO2 },
            { label: 'This Week',    start: dateToISO(mondayOf(new Date(now))), end: todayISO2 },
            { label: 'Last Week',    start: dateToISO(mondayOf(sub(7))),        end: dateToISO(new Date(mondayOf(sub(7)).getTime() + 6 * 86400000)) },
            { label: 'This Month',   start: monthStart(0), end: todayISO2 },
            { label: 'Last Month',   start: monthStart(-1), end: monthEnd(-1) },
          ]

          const inputStyle: React.CSSProperties = {
            background: 'var(--bg-row)', border: '1px solid var(--border-hi)',
            borderRadius: 7, color: 'var(--text-1)', padding: '6px 8px', fontSize: 13, outline: 'none',
          }
          const labelStyle: React.CSSProperties = {
            fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 5,
          }

          return (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', display: 'flex', overflow: 'hidden' }}>

              {/* Left: presets */}
              <div style={{ padding: '10px 6px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
                {presets.map((p) => {
                  const isActive = customRange?.start === p.start && customRange?.end === p.end
                  return (
                    <button
                      key={p.label}
                      onClick={() => applyCustomRange(p.start, p.end)}
                      style={{ textAlign: 'left', padding: '6px 10px', borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', background: isActive ? 'var(--accent-sub)' : 'none', color: isActive ? 'var(--accent)' : 'var(--text-2)', fontWeight: isActive ? 600 : 400 }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>

              {/* Right: custom inputs + actions */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div>
                    <div style={labelStyle}>From</div>
                    <input type="date" value={pickerStart} max={pickerEnd || todayISO2}
                      onChange={(e) => setPickerStart(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>To</div>
                    <input type="date" value={pickerEnd} min={pickerStart} max={todayISO2}
                      onChange={(e) => setPickerEnd(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowPicker(false)}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-3)', padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => applyCustomRange(pickerStart, pickerEnd)}
                    disabled={!pickerStart || !pickerEnd || pickerStart > pickerEnd}
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!pickerStart || !pickerEnd || pickerStart > pickerEnd) ? 0.4 : 1 }}>
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Scope toggle: Today / Week / Month */}
        <div style={{ marginLeft: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, display: 'flex', gap: 2 }}>
          {(['today', 'week', 'month'] as ViewScope[]).map((scope) => {
            const isActive = !selectedDay || selectedDay === today
              ? viewScope === scope
              : scope === 'today' && false  // when a past day is clicked none are "active"
            const active = viewScope === scope && (!selectedDay || selectedDay === today)
            return (
              <button
                key={scope}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: active ? 600 : 400, background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-3)', cursor: 'pointer', border: 'none', textTransform: 'capitalize' }}
                onClick={() => {
                  clearCustomRange()
                  setShowPicker(false)
                  setViewScope(scope)
                  if (scope === 'today') {
                    setSelectedDay(today)
                  } else {
                    setSelectedDay(null)
                    // Navigate back to current week when switching to week/month scope
                    if (!isCurrentWeek) setWeekStart(mondayOf(new Date()))
                  }
                }}
              >
                {scope.charAt(0).toUpperCase() + scope.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 14px 10px', marginBottom: 14, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height={148}>
          <BarChart
            data={activeChartData}
            barCategoryGap={chartDates.length <= 7 ? '32%' : chartDates.length <= 14 ? '20%' : '8%'}
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
                  <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{formatDuration(activeTotals.find((t) => t.app_name === app)?.total_ms ?? 0)}</span>
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
              No usage data{selectedDay && selectedDay !== today ? ' for this day' : viewScope === 'month' ? ' this month' : viewScope === 'week' ? ' this week' : ' today'}
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
              No usage data{selectedDay && selectedDay !== today ? ' for this day' : viewScope === 'month' ? ' this month' : viewScope === 'week' ? ' this week' : ' today'}
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
