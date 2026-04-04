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
