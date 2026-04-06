import { DatabaseWrapper } from '../db/sqljs-wrapper'
import { todayISO } from '../utils/timeUtils'
import { getCurrentSession } from './tracker'
import { sendReminderNotification } from './notifier'

const CHECK_INTERVAL_MS = 60_000 // check every minute

interface Reminder {
  id: number
  label: string
  app_name: string   // 'all' or specific app name
  threshold_ms: number
  is_enabled: number
}

let timer: NodeJS.Timeout | null = null
let db: DatabaseWrapper | null = null

// key: `${id}:${date}` — reset naturally as dates change
const firedToday = new Set<string>()
let lastResetDate = ''

export function startReminders(database: DatabaseWrapper): void {
  db = database
  timer = setInterval(checkReminders, CHECK_INTERVAL_MS)
  checkReminders()
}

export function stopReminders(): void {
  if (timer) { clearInterval(timer); timer = null }
}

function checkReminders(): void {
  if (!db) return
  const today = todayISO()

  // Reset fired set on new day
  if (today !== lastResetDate) {
    firedToday.clear()
    lastResetDate = today
  }

  const reminders = db
    .prepare('SELECT * FROM reminders WHERE is_enabled = 1')
    .all() as Reminder[]
  if (reminders.length === 0) return

  // Build today's totals from DB
  const rows = db
    .prepare('SELECT app_name, total_ms FROM daily_totals WHERE date = ?')
    .all(today) as { app_name: string; total_ms: number }[]

  const totalsByApp: Record<string, number> = {}
  let grandTotal = 0
  for (const r of rows) {
    totalsByApp[r.app_name] = r.total_ms
    grandTotal += r.total_ms
  }

  // Overlay current session (not yet flushed to DB)
  const session = getCurrentSession()
  if (session) {
    const extra = session.accumulatedMs
    totalsByApp[session.appName] = (totalsByApp[session.appName] ?? 0) + extra
    grandTotal += extra
  }

  for (const reminder of reminders) {
    const key = `${reminder.id}:${today}`
    if (firedToday.has(key)) continue

    const usage = reminder.app_name === 'all'
      ? grandTotal
      : (totalsByApp[reminder.app_name] ?? 0)

    if (usage >= reminder.threshold_ms) {
      firedToday.add(key)
      sendReminderNotification(reminder.label, reminder.app_name, reminder.threshold_ms)
    }
  }
}
