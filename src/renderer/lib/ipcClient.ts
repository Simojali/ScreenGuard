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
}

type SessionUpdateCallback = (data: { appName: string; todayTotalMs: number }) => void
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
