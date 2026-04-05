import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import { ipc } from '../lib/ipcClient'
import { dateToISO } from '../lib/dateUtils'
import { friendlyName } from '../lib/appNames'
import { useAppStore } from '../store/appStore'
import type { WeeklyReport, DailyTotal } from '../types'

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

const COLORS = ['#7c8cf8', '#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#fb7185']

export default function ReportsPage(): React.ReactElement {
  const [view, setView] = useState<'daily' | 'weekly'>('weekly')
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dailyData, setDailyData] = useState<DailyTotal[]>([])
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    if (view === 'daily') {
      ipc.getToday(dateToISO(selectedDate)).then(setDailyData)
    } else {
      ipc.getWeekly(dateToISO(weekStart)).then(setWeeklyReport)
    }
  }, [view, selectedDate, weekStart])

  const dailyChartData = dailyData
    .sort((a, b) => b.total_ms - a.total_ms)
    .slice(0, 10)
    .map((d) => ({ name: friendlyName(d.app_name), value: Math.round(d.total_ms / 60000) }))

  const weeklyChartData = weeklyReport?.dates
    ? weeklyReport.dates.map((date) => {
        const totals = weeklyReport.byDate[date] ?? []
        const total = totals.reduce((s, t) => s + t.total_ms, 0)
        return {
          date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
          minutes: Math.round(total / 60000),
        }
      })
    : []

  // Theme-aware chart colors
  const isDark = theme === 'dark'
  const axisStroke  = isDark ? '#374162' : '#c9d1e3'
  const tickFill    = isDark ? '#64748b' : '#9ca3af'
  const tickFill2   = isDark ? '#94a3b8' : '#4b5563'
  const ttBg        = isDark ? '#1e2133' : '#ffffff'
  const ttBorder    = isDark ? '#374162' : '#c9d1e3'
  const ttText      = isDark ? '#e2e8f0' : '#111827'

  const navBtnStyle: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border-hi)', borderRadius: 6,
    color: 'var(--text-2)', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-3)',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Reports</h1>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
          <button style={tabStyle(view === 'daily')} onClick={() => setView('daily')}>Daily</button>
          <button style={tabStyle(view === 'weekly')} onClick={() => setView('weekly')}>Weekly</button>
        </div>
      </div>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button style={navBtnStyle} onClick={() => {
          if (view === 'daily') { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d) }
          else { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
        }}><ChevronLeft size={16} /></button>

        <span style={{ fontSize: 14, color: 'var(--text-1)', minWidth: 180, textAlign: 'center' }}>
          {view === 'daily'
            ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          }
        </span>

        <button style={navBtnStyle} onClick={() => {
          if (view === 'daily') { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d) }
          else { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
        }}><ChevronRight size={16} /></button>
      </div>

      {/* Charts */}
      {view === 'daily' ? (
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Time by app (minutes)</div>
            {dailyChartData.length === 0 ? (
              <div style={{ color: 'var(--text-4)', textAlign: 'center', padding: '40px 0' }}>No data for this day</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} stroke={axisStroke} tick={{ fill: tickFill2, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: ttBg, border: `1px solid ${ttBorder}`, borderRadius: 8 }}
                    labelStyle={{ color: ttText }}
                    formatter={(v: number) => [`${v}m`, 'Time']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {dailyChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Share</div>
            {dailyChartData.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={dailyChartData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80}>
                    {dailyChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: ttBg, border: `1px solid ${ttBorder}`, borderRadius: 8 }}
                    formatter={(v: number) => [`${v}m`, 'Time']}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: tickFill2 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Daily total screen time (minutes)</div>
          {weeklyChartData.every((d) => d.minutes === 0) ? (
            <div style={{ color: 'var(--text-4)', textAlign: 'center', padding: '40px 0' }}>No data for this week</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyChartData} margin={{ left: 0, right: 20 }}>
                <XAxis dataKey="date" stroke={axisStroke} tick={{ fill: tickFill2, fontSize: 12 }} />
                <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: ttBg, border: `1px solid ${ttBorder}`, borderRadius: 8 }}
                  formatter={(v: number) => [formatDuration(v * 60000), 'Screen time']}
                  labelStyle={{ color: ttText }}
                />
                <Bar dataKey="minutes" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}
