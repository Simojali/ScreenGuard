import path from 'path'
import { DatabaseWrapper } from '../db/sqljs-wrapper'
import { killProcessByName } from '../utils/processKiller'
import { sendDowntimeNotification } from './notifier'
import { getCurrentSession } from './tracker'

const DOWNTIME_CHECK_INTERVAL_MS = 15000

interface DowntimeRule {
  id: number
  label: string
  days_of_week: string // JSON array e.g. "[1,2,3,4,5]"
  start_time: string   // "HH:MM"
  end_time: string     // "HH:MM"
  is_enabled: number
  applies_to: string   // "all" | JSON array of app_names
}

let downtimeTimer: NodeJS.Timeout | null = null
let db: DatabaseWrapper | null = null

export function startDowntime(database: DatabaseWrapper): void {
  db = database
  downtimeTimer = setInterval(enforceDowntime, DOWNTIME_CHECK_INTERVAL_MS)
}

export function stopDowntime(): void {
  if (downtimeTimer) {
    clearInterval(downtimeTimer)
    downtimeTimer = null
  }
}

async function enforceDowntime(): Promise<void> {
  if (!db) return

  const rules = db
    .prepare('SELECT * FROM downtime_rules WHERE is_enabled = 1')
    .all() as DowntimeRule[]

  const activeRules = rules.filter(isCurrentlyDowntime)
  if (activeRules.length === 0) return

  const session = getCurrentSession()
  if (!session) return

  for (const rule of activeRules) {
    const appliesToAll = rule.applies_to === 'all'
    let shouldBlock = false

    if (appliesToAll) {
      shouldBlock = true
    } else {
      try {
        const targetApps: string[] = JSON.parse(rule.applies_to)
        shouldBlock = targetApps.some(
          (name) => name.toLowerCase() === session.appName.toLowerCase()
        )
      } catch {
        shouldBlock = false
      }
    }

    if (shouldBlock) {
      sendDowntimeNotification(session.appName)
      await killProcessByName(path.basename(session.exePath))
      break // Only need to kill once per enforcement cycle
    }
  }
}

export function isCurrentlyDowntime(rule: DowntimeRule): boolean {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday

  let days: number[]
  try {
    days = JSON.parse(rule.days_of_week)
  } catch {
    return false
  }

  if (!days.includes(dayOfWeek)) return false

  const [startH, startM] = rule.start_time.split(':').map(Number)
  const [endH, endM] = rule.end_time.split(':').map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  // Support overnight ranges (e.g. 22:00 – 06:00)
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
}
