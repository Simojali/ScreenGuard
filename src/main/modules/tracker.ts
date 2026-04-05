import path from 'path'
import { BrowserWindow, powerMonitor } from 'electron'
import { DatabaseWrapper } from '../db/sqljs-wrapper'
import { getActiveWindow, stopWindowTracker } from '../utils/windowTracker'
import { todayISO, dateToISO } from '../utils/timeUtils'

const POLL_INTERVAL_MS = 2000
const FLUSH_INTERVAL_MS = 30000

/** Seconds of no keyboard/mouse input before we stop counting screen time */
const IDLE_THRESHOLD_SECONDS = 5 * 60  // 5 minutes

let idleEnabled = true
let idleThresholdSec = IDLE_THRESHOLD_SECONDS

export function setIdleConfig(enabled: boolean, thresholdMinutes: number): void {
  idleEnabled = enabled
  idleThresholdSec = thresholdMinutes * 60
}

interface ActiveSession {
  appName: string
  exePath: string
  windowTitle: string
  pid: number
  sessionId: number
  startTime: number
  lastTickTime: number
  accumulatedMs: number
  lastFlushTime: number
}

let currentSession: ActiveSession | null = null
let pollTimer: NodeJS.Timeout | null = null
let db: DatabaseWrapper | null = null
let mainWindow: BrowserWindow | null = null

export function startTracker(database: DatabaseWrapper, window: BrowserWindow): void {
  db = database
  mainWindow = window
  pollTimer = setInterval(pollActiveWindow, POLL_INTERVAL_MS)
  // Run first poll immediately
  pollActiveWindow()
}

export function stopTracker(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (currentSession) {
    flushAndEndSession(Date.now())
    currentSession = null
  }
  stopWindowTracker()
}

export function getCurrentSession(): ActiveSession | null {
  return currentSession
}

async function pollActiveWindow(): Promise<void> {
  try {
    const info = await getActiveWindow()
    const now = Date.now()

    if (!info || !info.path) return

    // Skip our own Electron process
    const selfExe = path.basename(process.execPath).toLowerCase()
    const infoExe = path.basename(info.path || info.name).toLowerCase()
    if (
      infoExe === selfExe ||
      infoExe === 'electron.exe' ||
      info.name.toLowerCase().includes('electron')
    ) return

    // ── Idle detection ──────────────────────────────────────────────────────
    // If the user hasn't touched keyboard or mouse for IDLE_THRESHOLD_SECONDS,
    // don't count this time against any app.
    const idleSeconds = powerMonitor.getSystemIdleTime()
    const isIdle = idleEnabled && idleSeconds >= idleThresholdSec

    const newAppName = info.name  // already has .exe from windowTracker
    const newExePath = info.path
    const newTitle = info.title
    const newPid = info.pid

    if (!currentSession) {
      if (!isIdle) beginSession(newAppName, newExePath, newTitle, newPid, now)
      return
    }

    if (newAppName.toLowerCase() !== currentSession.appName.toLowerCase()) {
      flushAndEndSession(now)
      currentSession = null
      if (!isIdle) beginSession(newAppName, newExePath, newTitle, newPid, now)
      return
    }

    // Same app still in foreground — only accumulate when the user is active.
    // Always advance lastTickTime so the idle gap is never counted on return.
    const delta = now - currentSession.lastTickTime
    currentSession.lastTickTime = now
    currentSession.windowTitle = newTitle

    if (!isIdle) {
      currentSession.accumulatedMs += delta
    }

    if (now - currentSession.lastFlushTime >= FLUSH_INTERVAL_MS) {
      flushSession(now)
    }

    sendSessionUpdate(isIdle)
  } catch (err) {
    console.error('[tracker] poll error:', err)
  }
}

function beginSession(
  appName: string,
  exePath: string,
  windowTitle: string,
  pid: number,
  now: number
): void {
  if (!db) return
  const result = db
    .prepare(
      `INSERT INTO usage_sessions (app_name, exe_path, window_title, started_at, ended_at, duration_ms)
       VALUES (?, ?, ?, ?, NULL, 0)`
    )
    .run(appName, exePath, windowTitle, now)

  currentSession = {
    appName,
    exePath,
    windowTitle,
    pid,
    sessionId: result.lastInsertRowid,
    startTime: now,
    lastTickTime: now,
    accumulatedMs: 0,
    lastFlushTime: now
  }
}

function flushSession(now: number): void {
  if (!db || !currentSession || currentSession.accumulatedMs <= 0) return

  const date = dateToISO(new Date(currentSession.startTime))

  db.prepare(
    `INSERT INTO daily_totals (date, app_name, exe_path, total_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date, app_name) DO UPDATE SET total_ms = total_ms + excluded.total_ms`
  ).run(date, currentSession.appName, currentSession.exePath, currentSession.accumulatedMs)

  db.prepare(`UPDATE usage_sessions SET duration_ms = ?, window_title = ? WHERE id = ?`).run(
    currentSession.accumulatedMs,
    currentSession.windowTitle,
    currentSession.sessionId
  )

  currentSession.accumulatedMs = 0
  currentSession.lastFlushTime = now
}

function flushAndEndSession(now: number): void {
  if (!db || !currentSession) return

  const remaining = now - currentSession.lastFlushTime
  if (remaining > 0) currentSession.accumulatedMs += remaining

  const totalMs = currentSession.accumulatedMs
  const date = dateToISO(new Date(currentSession.startTime))

  if (totalMs > 0) {
    db.prepare(
      `INSERT INTO daily_totals (date, app_name, exe_path, total_ms)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date, app_name) DO UPDATE SET total_ms = total_ms + excluded.total_ms`
    ).run(date, currentSession.appName, currentSession.exePath, totalMs)
  }

  db.prepare(`UPDATE usage_sessions SET ended_at = ?, duration_ms = ? WHERE id = ?`).run(
    now,
    totalMs,
    currentSession.sessionId
  )
}

function sendSessionUpdate(isIdle = false): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (!db || !currentSession) return

  const today = todayISO()
  const row = db
    .prepare('SELECT total_ms FROM daily_totals WHERE date = ? AND app_name = ?')
    .get(today, currentSession.appName) as { total_ms: number } | undefined

  const todayTotalMs = (row?.total_ms ?? 0) + currentSession.accumulatedMs

  mainWindow.webContents.send('tracker:session-update', {
    appName: currentSession.appName,
    todayTotalMs,
    isIdle,
  })
}
