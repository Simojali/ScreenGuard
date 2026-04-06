import { contextBridge, ipcRenderer } from 'electron'

export type DailyTotal = {
  date: string
  app_name: string
  exe_path: string
  total_ms: number
}

export type WeeklyReport = {
  dates: string[]
  byDate: Record<string, DailyTotal[]>
}

export type AppLimit = {
  id: number
  app_name: string
  exe_path: string
  limit_ms: number
  is_enabled: number
}

export type DowntimeRule = {
  id: number
  label: string
  days_of_week: string
  start_time: string
  end_time: string
  is_enabled: number
  applies_to: string
}

export type KnownApp = {
  app_name: string
  exe_path: string
}

const api = {
  // Usage
  getToday: (date?: string): Promise<DailyTotal[]> =>
    ipcRenderer.invoke('usage:get-today', { date }),
  getWeekly: (weekStartDate: string): Promise<WeeklyReport> =>
    ipcRenderer.invoke('usage:get-weekly', { weekStartDate }),

  // Apps
  getKnownApps: (): Promise<KnownApp[]> => ipcRenderer.invoke('apps:get-known'),

  // Limits
  getLimits: (): Promise<AppLimit[]> => ipcRenderer.invoke('limits:get-all'),
  setLimit: (appName: string, exePath: string, limitMs: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('limits:set', { appName, exePath, limitMs }),
  deleteLimit: (appName: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('limits:delete', { appName }),
  toggleLimit: (appName: string, isEnabled: boolean): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('limits:toggle', { appName, isEnabled }),

  // Downtime
  getDowntimeRules: (): Promise<DowntimeRule[]> => ipcRenderer.invoke('downtime:get-all'),
  createDowntimeRule: (
    rule: Omit<DowntimeRule, 'id'>
  ): Promise<{ id: number }> => ipcRenderer.invoke('downtime:create', rule),
  updateDowntimeRule: (rule: DowntimeRule): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('downtime:update', rule),
  deleteDowntimeRule: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('downtime:delete', { id }),

  // Tracker
  getCurrentSession: (): Promise<{ appName: string; exePath: string } | null> =>
    ipcRenderer.invoke('tracker:get-current'),

  // Icons
  getAppIcon: (exePath: string): Promise<string | null> =>
    ipcRenderer.invoke('apps:get-icon', { exePath }),

  // Category customization
  getCategoryOverrides: (): Promise<{ app_name: string; category_id: string }[]> =>
    ipcRenderer.invoke('categories:get-overrides'),
  setCategoryOverride: (appName: string, categoryId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('categories:set-override', { appName, categoryId }),
  removeCategoryOverride: (appName: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('categories:remove-override', { appName }),
  resetCategoryOverrides: (categoryId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('categories:reset-overrides-for', { categoryId }),
  getCategoryLabels: (): Promise<{ category_id: string; label: string }[]> =>
    ipcRenderer.invoke('categories:get-labels'),
  setCategoryLabel: (categoryId: string, label: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('categories:set-label', { categoryId, label }),
  resetCategoryLabel: (categoryId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('categories:reset-label', { categoryId }),

  // File picker
  pickExe: (): Promise<{ app_name: string; exe_path: string } | null> =>
    ipcRenderer.invoke('dialog:pick-exe'),

  // Settings
  getSettings: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('settings:get-all'),
  setSetting: (key: string, value: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('settings:set', { key, value }),
  getStartupEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:get-startup'),
  setStartupEnabled: (enabled: boolean): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('settings:set-startup', { enabled }),
  clearHistory: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('settings:clear-history'),

  // Reminders
  getReminders: (): Promise<{ id: number; label: string; app_name: string; threshold_ms: number; is_enabled: number }[]> =>
    ipcRenderer.invoke('reminders:get-all'),
  createReminder: (r: { label: string; app_name: string; threshold_ms: number }): Promise<{ id: number }> =>
    ipcRenderer.invoke('reminders:create', r),
  updateReminder: (r: { id: number; label: string; app_name: string; threshold_ms: number; is_enabled: number }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('reminders:update', r),
  deleteReminder: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('reminders:delete', { id }),
  toggleReminder: (id: number, isEnabled: boolean): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('reminders:toggle', { id, isEnabled }),

  // Push event listeners
  onSessionUpdate: (
    callback: (data: { appName: string; todayTotalMs: number; isIdle: boolean }) => void
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { appName: string; todayTotalMs: number; isIdle: boolean }) =>
      callback(data)
    ipcRenderer.on('tracker:session-update', handler)
    return () => ipcRenderer.removeListener('tracker:session-update', handler)
  },

  onLimitBreach: (callback: (data: { appName: string; action: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { appName: string; action: string }) =>
      callback(data)
    ipcRenderer.on('limit:breach', handler)
    return () => ipcRenderer.removeListener('limit:breach', handler)
  },

  onDayChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('tracker:day-changed', handler)
    return () => ipcRenderer.removeListener('tracker:day-changed', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
