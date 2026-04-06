import { ipcMain, app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { DatabaseWrapper } from '../db/sqljs-wrapper'
import { todayISO, weekRange } from '../utils/timeUtils'
import { getCurrentSession, setIdleConfig } from '../modules/tracker'

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

  // ─── File picker ──────────────────────────────────────────────────────────

  ipcMain.handle('dialog:pick-exe', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Application',
      filters: [{ name: 'Executable', extensions: ['exe'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const exePath = result.filePaths[0]
    const appName = path.basename(exePath) // e.g. "WhatsApp.exe"
    return { app_name: appName, exe_path: exePath }
  })

  // ─── App icons ────────────────────────────────────────────────────────────

  ipcMain.handle('apps:get-icon', async (_event, { exePath }: { exePath: string }) => {
    if (!exePath) return null

    // Primary: try to get the icon directly from the exe (works for regular apps)
    try {
      const icon = await app.getFileIcon(exePath, { size: 'normal' })
      return icon.toDataURL()
    } catch { /* fall through */ }

    // Fallback for UWP / Windows Store apps:
    // Windows caches notification/action-center icons for every installed Store app
    // as PNG files in %LOCALAPPDATA%\Microsoft\Windows\ActionCenterCache\.
    // The filenames contain the lowercased package name, so we can match by app base name.
    try {
      const localAppData = process.env.LOCALAPPDATA ?? ''
      const cacheDir = path.join(localAppData, 'Microsoft', 'Windows', 'ActionCenterCache')

      // Derive a key from the exe name, stripping .exe and UWP suffixes (.Root/.Desktop/.App)
      const appKey = path
        .basename(exePath, path.extname(exePath))
        .replace(/\.(Root|Desktop|App)$/i, '')
        .toLowerCase()

      const files = fs.readdirSync(cacheDir).filter(
        (f) => f.toLowerCase().includes(appKey) && f.endsWith('.png')
      )

      if (files.length > 0) {
        // Prefer the largest file (best resolution)
        const sorted = files
          .map((f) => ({ f, size: fs.statSync(path.join(cacheDir, f)).size }))
          .sort((a, b) => b.size - a.size)

        const imgPath = path.join(cacheDir, sorted[0].f)
        const data = fs.readFileSync(imgPath)
        return `data:image/png;base64,${data.toString('base64')}`
      }
    } catch { /* ignore */ }

    return null
  })

  // ─── Category customization ───────────────────────────────────────────────

  ipcMain.handle('categories:get-overrides', () => {
    return db.prepare('SELECT app_name, category_id FROM category_overrides').all()
  })

  ipcMain.handle('categories:set-override', (_event, { appName, categoryId }: { appName: string; categoryId: string }) => {
    db.prepare(
      `INSERT INTO category_overrides (app_name, category_id) VALUES (?, ?)
       ON CONFLICT(app_name) DO UPDATE SET category_id = excluded.category_id`
    ).run(appName, categoryId)
    return { success: true }
  })

  ipcMain.handle('categories:remove-override', (_event, { appName }: { appName: string }) => {
    db.prepare('DELETE FROM category_overrides WHERE app_name = ?').run(appName)
    return { success: true }
  })

  ipcMain.handle('categories:reset-overrides-for', (_event, { categoryId }: { categoryId: string }) => {
    db.prepare('DELETE FROM category_overrides WHERE category_id = ?').run(categoryId)
    return { success: true }
  })

  ipcMain.handle('categories:get-labels', () => {
    return db.prepare('SELECT category_id, label FROM category_labels').all()
  })

  ipcMain.handle('categories:set-label', (_event, { categoryId, label }: { categoryId: string; label: string }) => {
    db.prepare(
      `INSERT INTO category_labels (category_id, label) VALUES (?, ?)
       ON CONFLICT(category_id) DO UPDATE SET label = excluded.label`
    ).run(categoryId, label)
    return { success: true }
  })

  ipcMain.handle('categories:reset-label', (_event, { categoryId }: { categoryId: string }) => {
    db.prepare('DELETE FROM category_labels WHERE category_id = ?').run(categoryId)
    return { success: true }
  })

  // ─── Settings ─────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get-all', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const out: Record<string, string> = {}
    for (const r of rows) out[r.key] = r.value
    return out
  })

  ipcMain.handle('settings:set', (_event, { key, value }: { key: string; value: string }) => {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(key, value)

    // Apply live if it's an idle setting
    if (key === 'idle_enabled' || key === 'idle_threshold_minutes') {
      const enabled = (db.prepare("SELECT value FROM settings WHERE key = 'idle_enabled'").get() as { value: string } | undefined)?.value !== 'false'
      const minutes = parseInt((db.prepare("SELECT value FROM settings WHERE key = 'idle_threshold_minutes'").get() as { value: string } | undefined)?.value ?? '5', 10)
      setIdleConfig(enabled, minutes)
    }

    return { success: true }
  })

  ipcMain.handle('settings:get-startup', () => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('settings:set-startup', (_event, { enabled }: { enabled: boolean }) => {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
    return { success: true }
  })

  ipcMain.handle('settings:clear-history', () => {
    db.prepare('DELETE FROM daily_totals').run()
    db.prepare('DELETE FROM usage_sessions').run()
    return { success: true }
  })

  // ─── Reminders ────────────────────────────────────────────────────────────

  ipcMain.handle('reminders:get-all', () => {
    return db.prepare('SELECT * FROM reminders ORDER BY id').all()
  })

  ipcMain.handle('reminders:create', (_event, r: { label: string; app_name: string; threshold_ms: number }) => {
    const result = db.prepare(
      `INSERT INTO reminders (label, app_name, threshold_ms, is_enabled) VALUES (?, ?, ?, 1)`
    ).run(r.label, r.app_name, r.threshold_ms)
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('reminders:update', (_event, r: { id: number; label: string; app_name: string; threshold_ms: number; is_enabled: number }) => {
    db.prepare(
      `UPDATE reminders SET label=?, app_name=?, threshold_ms=?, is_enabled=? WHERE id=?`
    ).run(r.label, r.app_name, r.threshold_ms, r.is_enabled, r.id)
    return { success: true }
  })

  ipcMain.handle('reminders:delete', (_event, { id }: { id: number }) => {
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('reminders:toggle', (_event, { id, isEnabled }: { id: number; isEnabled: boolean }) => {
    db.prepare('UPDATE reminders SET is_enabled = ? WHERE id = ?').run(isEnabled ? 1 : 0, id)
    return { success: true }
  })
}
