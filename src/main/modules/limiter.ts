import { BrowserWindow } from 'electron'
import { DatabaseWrapper } from '../db/sqljs-wrapper'
import { todayISO, startOfDayMs } from '../utils/timeUtils'
import { killProcessByName } from '../utils/processKiller'
import { sendLimitWarningNotification, sendLimitBreachNotification } from './notifier'

const LIMIT_CHECK_INTERVAL_MS = 10000
const WARN_THRESHOLD = 0.9

interface AppLimit {
  id: number
  app_name: string
  exe_path: string
  limit_ms: number
  is_enabled: number
}

let limitTimer: NodeJS.Timeout | null = null
let db: DatabaseWrapper | null = null
let mainWindow: BrowserWindow | null = null

// Track which apps got a warning today to avoid repeat warnings
const warningSentToday = new Set<string>()
let warningResetDate = todayISO()

export function startLimiter(database: DatabaseWrapper, window: BrowserWindow): void {
  db = database
  mainWindow = window
  limitTimer = setInterval(checkAllLimits, LIMIT_CHECK_INTERVAL_MS)
}

export function stopLimiter(): void {
  if (limitTimer) {
    clearInterval(limitTimer)
    limitTimer = null
  }
}

async function checkAllLimits(): Promise<void> {
  if (!db) return

  // Reset per-day warning set at midnight
  const today = todayISO()
  if (today !== warningResetDate) {
    warningSentToday.clear()
    warningResetDate = today
  }

  const limits = db
    .prepare('SELECT * FROM app_limits WHERE is_enabled = 1')
    .all() as AppLimit[]

  for (const limit of limits) {
    const row = db
      .prepare('SELECT total_ms FROM daily_totals WHERE date = ? AND app_name = ?')
      .get(today, limit.app_name) as { total_ms: number } | undefined

    const usedMs = row?.total_ms ?? 0

    if (usedMs >= limit.limit_ms) {
      // Check if already killed today
      const alreadyKilled = wasKilledToday(limit.app_name, today)
      if (!alreadyKilled) {
        sendLimitBreachNotification(limit.app_name)
        logBreach(limit.app_name, 'notified')
        await killProcessByName(limit.app_name)
        logBreach(limit.app_name, 'killed')
        mainWindow?.webContents.send('limit:breach', {
          appName: limit.app_name,
          action: 'killed'
        })
      }
    } else if (usedMs >= limit.limit_ms * WARN_THRESHOLD) {
      if (!warningSentToday.has(limit.app_name)) {
        const pct = Math.round((usedMs / limit.limit_ms) * 100)
        sendLimitWarningNotification(limit.app_name, pct)
        warningSentToday.add(limit.app_name)
      }
    }
  }
}

function wasKilledToday(appName: string, date: string): boolean {
  if (!db) return false
  const dayStart = startOfDayMs(date)
  const row = db
    .prepare(
      `SELECT id FROM limit_breach_log
       WHERE app_name = ? AND breached_at >= ? AND action = 'killed'`
    )
    .get(appName, dayStart)
  return row != null
}

function logBreach(appName: string, action: 'notified' | 'killed'): void {
  if (!db) return
  db.prepare(
    'INSERT INTO limit_breach_log (app_name, breached_at, action) VALUES (?, ?, ?)'
  ).run(appName, Date.now(), action)
}
