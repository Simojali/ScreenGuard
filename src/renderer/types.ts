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
  days_of_week: string  // JSON array e.g. "[1,2,3,4,5]"
  start_time: string    // "HH:MM"
  end_time: string      // "HH:MM"
  is_enabled: number
  applies_to: string    // "all" | JSON array of app_names
}

export type KnownApp = {
  app_name: string
  exe_path: string
}

export type Reminder = {
  id: number
  label: string
  app_name: string   // 'all' or specific app name
  threshold_ms: number
  is_enabled: number
}
