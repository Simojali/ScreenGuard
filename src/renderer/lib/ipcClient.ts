// Typed wrappers around window.api
// Falls back gracefully when running in a plain browser (for development without Electron)

const api = (window as typeof window & { api: Record<string, (...args: unknown[]) => unknown> }).api ?? {}

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (typeof api[channel] === 'function') {
    return (api[channel] as (...a: unknown[]) => Promise<T>)(...args)
  }
  return Promise.resolve([] as unknown as T)
}

export const ipc = {
  getToday: (date?: string) => invoke<import('../types').DailyTotal[]>('getToday', date),
  getWeekly: (weekStartDate: string) => invoke<import('../types').WeeklyReport>('getWeekly', weekStartDate)
    .then(r => (r && typeof r === 'object' && 'dates' in r) ? r : { dates: [], byDate: {} }),
  getKnownApps: () => invoke<import('../types').KnownApp[]>('getKnownApps'),
  getLimits: () => invoke<import('../types').AppLimit[]>('getLimits'),
  setLimit: (appName: string, exePath: string, limitMs: number) =>
    invoke<{ success: boolean }>('setLimit', appName, exePath, limitMs),
  deleteLimit: (appName: string) => invoke<{ success: boolean }>('deleteLimit', appName),
  toggleLimit: (appName: string, isEnabled: boolean) =>
    invoke<{ success: boolean }>('toggleLimit', appName, isEnabled),
  getDowntimeRules: () => invoke<import('../types').DowntimeRule[]>('getDowntimeRules'),
  createDowntimeRule: (rule: Omit<import('../types').DowntimeRule, 'id'>) =>
    invoke<{ id: number }>('createDowntimeRule', rule),
  updateDowntimeRule: (rule: import('../types').DowntimeRule) =>
    invoke<{ success: boolean }>('updateDowntimeRule', rule),
  deleteDowntimeRule: (id: number) => invoke<{ success: boolean }>('deleteDowntimeRule', id),
  getCurrentSession: () =>
    invoke<{ appName: string; exePath: string } | null>('getCurrentSession'),
  getAppIcon: (exePath: string) =>
    invoke<string | null>('getAppIcon', exePath),

  // Category customization
  getCategoryOverrides: () =>
    invoke<{ app_name: string; category_id: string }[]>('getCategoryOverrides'),
  setCategoryOverride: (appName: string, categoryId: string) =>
    invoke<{ success: boolean }>('setCategoryOverride', appName, categoryId),
  removeCategoryOverride: (appName: string) =>
    invoke<{ success: boolean }>('removeCategoryOverride', appName),
  resetCategoryOverrides: (categoryId: string) =>
    invoke<{ success: boolean }>('resetCategoryOverrides', categoryId),
  getCategoryLabels: () =>
    invoke<{ category_id: string; label: string }[]>('getCategoryLabels'),
  setCategoryLabel: (categoryId: string, label: string) =>
    invoke<{ success: boolean }>('setCategoryLabel', categoryId, label),
  resetCategoryLabel: (categoryId: string) =>
    invoke<{ success: boolean }>('resetCategoryLabel', categoryId),

  // File picker
  pickExe: () => invoke<{ app_name: string; exe_path: string } | null>('pickExe'),

  // Reminders
  getReminders: () => invoke<import('../types').Reminder[]>('getReminders'),
  createReminder: (r: { label: string; app_name: string; threshold_ms: number }) =>
    invoke<{ id: number }>('createReminder', r),
  updateReminder: (r: import('../types').Reminder) =>
    invoke<{ success: boolean }>('updateReminder', r),
  deleteReminder: (id: number) => invoke<{ success: boolean }>('deleteReminder', id),
  toggleReminder: (id: number, isEnabled: boolean) =>
    invoke<{ success: boolean }>('toggleReminder', id, isEnabled),

  // Settings
  getSettings: () => invoke<Record<string, string>>('getSettings'),
  setSetting: (key: string, value: string) => invoke<{ success: boolean }>('setSetting', key, value),
  getStartupEnabled: () => invoke<boolean>('getStartupEnabled'),
  setStartupEnabled: (enabled: boolean) => invoke<{ success: boolean }>('setStartupEnabled', enabled),
  clearHistory: () => invoke<{ success: boolean }>('clearHistory'),
}

type SessionUpdateCallback = (data: { appName: string; todayTotalMs: number; isIdle: boolean }) => void
type BreachCallback = (data: { appName: string; action: string }) => void

export function onSessionUpdate(cb: SessionUpdateCallback): () => void {
  const rawApi = (window as typeof window & { api: { onSessionUpdate?: (cb: SessionUpdateCallback) => () => void } }).api
  if (rawApi?.onSessionUpdate) return rawApi.onSessionUpdate(cb)
  return () => {}
}

export function onLimitBreach(cb: BreachCallback): () => void {
  const rawApi = (window as typeof window & { api: { onLimitBreach?: (cb: BreachCallback) => () => void } }).api
  if (rawApi?.onLimitBreach) return rawApi.onLimitBreach(cb)
  return () => {}
}

export function onDayChanged(cb: () => void): () => void {
  const rawApi = (window as typeof window & { api: { onDayChanged?: (cb: () => void) => () => void } }).api
  if (rawApi?.onDayChanged) return rawApi.onDayChanged(cb)
  return () => {}
}
