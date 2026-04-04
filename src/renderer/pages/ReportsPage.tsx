import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import { ipc } from '../lib/ipcClient'
import { dateToISO } from '../lib/dateUtils'
import { friendlyName } from '../lib/appNames'
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
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

const COLORS = ['#7c8cf8', '#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#fb7185']

export default function ReportsPage(): React.ReactElement {
  const [view, setView] = useState<'daily' | 'weekly'>('weekly')
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dailyData, setDailyData] = useState<DailyTotal[]>([])
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)

  useEffect(() => {
    if (view === 'daily') {
      ipc.getToday(dateToISO(selectedDate)).then(setDailyData)
    } else {
      ipc.getWeekly(dateToISO(weekStart)).then(setWeeklyReport)
    }
  }, [view, selectedDate, weekStart])

  // ── Daily view data ──────────────────────────────────────────────────────
  const dailyChartData = dailyData
    .sort((a, b) => b.total_ms - a.total_ms)
    .slice(0, 10)
    .map((d) => ({ name: friendlyName(d.app_name), value: Math.round(d.total_ms / 60000) }))

  // ── Weekly view data ─────────────────────────────────────────────────────
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

  const navBtnStyle: React.CSSProperties = {
    background: 'none', border: '1px solid #374162', borderRadius: 6,
    color: '#94a3b8', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
    background: active ? '#7c8cf8' : 'transparent',
    color: active ? '#fff' : '#64748b',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>Reports</h1>

        <div style={{ display: 'flex', gap: 4, background: '#1a1d2e', borderRadius: 8, padding: 4, border: '1px solid #2d3148' }}>
          <button style={tabStyle(view === 'daily')} onClick={() => setView('daily')}>Daily</button>
          <button style={tabStyle(view === 'weekly')} onClick={() => setView('weekly')}>Weekly</button>
        </div>
      </div>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          style={navBtnStyle}
          onClick={() => {
            if (view === 'daily') { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d) }
            else { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
          }}
        ><ChevronLeft size={16} /></button>

        <span style={{ fontSize: 14, color: '#e2e8f0', minWidth: 180, textAlign: 'center' }}>
          {view === 'daily'
            ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          }
        </span>

        <button
          style={navBtnStyle}
          onClick={() => {
            if (view === 'daily') { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d) }
            else { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
          }}
        ><ChevronRight size={16} /></button>
      </div>

      {/* Charts */}
      {view === 'daily' ? (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Bar chart */}
          <div style={{ flex: 2, background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Time by app (minutes)</div>
            {dailyChartData.length === 0 ? (
              <div style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>No data for this day</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" stroke="#374162" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} stroke="#374162" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e2133', border: '1px solid #374162', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(v: number) => [`${v}m`, 'Time']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {dailyChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie chart */}
          <div style={{ flex: 1, background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Share</div>
            {dailyChartData.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={dailyChartData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80}>
                    {dailyChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e2133', border: '1px solid #374162', borderRadius: 8 }}
                    formatter={(v: number) => [`${v}m`, 'Time']}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Daily total screen time (minutes)</div>
          {weeklyChartData.every((d) => d.minutes === 0) ? (
            <div style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>No data for this week</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyChartData} margin={{ left: 0, right: 20 }}>
                <XAxis dataKey="date" stroke="#374162" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#374162" tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e2133', border: '1px solid #374162', borderRadius: 8 }}
                  formatter={(v: number) => [formatDuration(v * 60000), 'Screen time']}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="minutes" fill="#7c8cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}
