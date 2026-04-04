import { ipcMain, app } from 'electron'
import { DatabaseWrapper } from '../db/sqljs-wrapper'
import { todayISO, weekRange } from '../utils/timeUtils'
import { getCurrentSession } from '../modules/tracker'

interface DailyTotal {
  date: string
  app_name: string
  exe_path: string
  total_ms: number
}

export function initIpcHandlers(db: DatabaseWrapper): void {
  // ─── Usage ───────────────────────────────────────────────────────────────

  ipcMain.handle('usage:get-today', (_event, { date }: { date?: string } = {}) => {
    const target = date ?? todayISO()
    return db.prepare('SELECT * FROM daily_totals WHERE date = ? ORDER BY total_ms DESC').all(target)
  })

  ipcMain.handle('usage:get-weekly', (_event, { weekStartDate }: { weekStartDate: string }) => {
    const dates = weekRange(weekStartDate)
    const placeholders = dates.map(() => '?').join(',')
    const rows = db
      .prepare(
        `SELECT * FROM daily_totals WHERE date IN (${placeholders}) ORDER BY date, total_ms DESC`
      )
      .all(...dates) as DailyTotal[]

    // Group by date
    const byDate: Record<string, DailyTotal[]> = {}
    for (const date of dates) byDate[date] = []
    for (const row of rows) {
      if (byDate[row.date]) byDate[row.date].push(row)
    }
    return { dates, byDate }
  })

  // ─── Apps ─────────────────────────────────────────────────────────────────

  ipcMain.handle('apps:get-known', () => {
    return db
      .prepare(
        `SELECT DISTINCT app_name, exe_path FROM daily_totals ORDER BY app_name`
      )
      .all()
  })

  // ─── Limits ───────────────────────────────────────────────────────────────

  ipcMain.handle('limits:get-all', () => {
    return db.prepare('SELECT * FROM app_limits ORDER BY app_name').all()
  })

  ipcMain.handle(
    'limits:set',
    (_event, { appName, exePath, limitMs }: { appName: string; exePath: string; limitMs: number }) => {
      db.prepare(
        `INSERT INTO app_limits (app_name, exe_path, limit_ms, is_enabled)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(app_name) DO UPDATE SET exe_path = excluded.exe_path, limit_ms = excluded.limit_ms, is_enabled = 1`
      ).run(appName, exePath, limitMs)
      return { success: true }
    }
  )

  ipcMain.handle('limits:delete', (_event, { appName }: { appName: string }) => {
    db.prepare('DELETE FROM app_limits WHERE app_name = ?').run(appName)
    return { success: true }
  })

  ipcMain.handle(
    'limits:toggle',
    (_event, { appName, isEnabled }: { appName: string; isEnabled: boolean }) => {
      db.prepare('UPDATE app_limits SET is_enabled = ? WHERE app_name = ?').run(
        isEnabled ? 1 : 0,
        appName
      )
      return { success: true }
    }
  )

  // ─── Downtime ─────────────────────────────────────────────────────────────

  ipcMain.handle('downtime:get-all', () => {
    return db.prepare('SELECT * FROM downtime_rules ORDER BY id').all()
  })

  ipcMain.handle(
    'downtime:create',
    (
      _event,
      rule: {
        label: string
        days_of_week: string
        start_time: string
        end_time: string
        is_enabled: number
        applies_to: string
      }
    ) => {
      const result = db
        .prepare(
          `INSERT INTO downtime_rules (label, days_of_week, start_time, end_time, is_enabled, applies_to)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          rule.label,
          rule.days_of_week,
          rule.start_time,
          rule.end_time,
          rule.is_enabled,
          rule.applies_to
        )
      return { id: result.lastInsertRowid }
    }
  )

  ipcMain.handle(
    'downtime:update',
    (
      _event,
      rule: {
        id: number
        label: string
        days_of_week: string
        start_time: string
        end_time: string
        is_enabled: number
        applies_to: string
      }
    ) => {
      db.prepare(
        `UPDATE downtime_rules SET label=?, days_of_week=?, start_time=?, end_time=?, is_enabled=?, applies_to=?
         WHERE id=?`
      ).run(rule.label, rule.days_of_week, rule.start_time, rule.end_time, rule.is_enabled, rule.applies_to, rule.id)
      return { success: true }
    }
  )

  ipcMain.handle('downtime:delete', (_event, { id }: { id: number }) => {
    db.prepare('DELETE FROM downtime_rules WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── Tracker state ────────────────────────────────────────────────────────

  ipcMain.handle('tracker:get-current', () => {
    const session = getCurrentSession()
    if (!session) return null
    return { appName: session.appName, exePath: session.exePath }
  })

  // ─── App icons ────────────────────────────────────────────────────────────

  ipcMain.handle('apps:get-icon', async (_event, { exePath }: { exePath: string }) => {
    try {
      const icon = await app.getFileIcon(exePath, { size: 'normal' })
      return icon.toDataURL()
    } catch {
      return null
    }
  })
}
