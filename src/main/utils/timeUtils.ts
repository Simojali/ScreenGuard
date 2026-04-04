/**
 * Returns today's date as "YYYY-MM-DD" in local time.
 */
export function todayISO(): string {
  return dateToISO(new Date())
}

/**
 * Converts a Date to "YYYY-MM-DD" in local time.
 */
export function dateToISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns the Unix timestamp (ms) for the start of a given ISO date string (local midnight).
 */
export function startOfDayMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

/**
 * Returns an array of 7 ISO date strings starting from the given weekStart date.
 */
export function weekRange(weekStartISO: string): string[] {
  const [y, m, d] = weekStartISO.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return dateToISO(day)
  })
}

/**
 * Returns the ISO date string for the Monday of the current week.
 */
export function currentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return dateToISO(monday)
}

/**
 * Formats milliseconds into "Xh Ym" or "Ym" if under an hour.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${totalSeconds}s`
}
