import { Notification } from 'electron'

export function sendLimitWarningNotification(appName: string, percentUsed: number): void {
  new Notification({
    title: 'ScreenGuard Warning',
    body: `${appName} has used ${percentUsed}% of its daily limit.`,
    silent: false
  }).show()
}

export function sendLimitBreachNotification(appName: string): void {
  new Notification({
    title: 'ScreenGuard — Limit Reached',
    body: `Daily limit for ${appName} has been reached. The app will be closed.`,
    silent: false
  }).show()
}

export function sendDowntimeNotification(appName: string): void {
  new Notification({
    title: 'Downtime Active',
    body: `${appName} was closed because downtime is active.`,
    silent: false
  }).show()
}

export function sendReminderNotification(label: string, appName: string, thresholdMs: number): void {
  const h = Math.floor(thresholdMs / 3600000)
  const m = Math.floor((thresholdMs % 3600000) / 60000)
  const timeStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
  const target = appName === 'all' ? 'all apps' : appName.replace(/\.exe$/i, '')
  new Notification({
    title: label || 'Screen Time Reminder',
    body: `You've spent ${timeStr} on ${target} today.`,
    silent: false,
  }).show()
}
