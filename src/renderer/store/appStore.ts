import { create } from 'zustand'
import type { DailyTotal } from '../types'

interface AppState {
  currentApp: string | null
  todayTotals: Record<string, number>  // appName -> total_ms (live, from push events)
  setCurrentApp: (appName: string | null) => void
  updateTodayTotal: (appName: string, totalMs: number) => void
  setTodayTotals: (totals: DailyTotal[]) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentApp: null,
  todayTotals: {},

  setCurrentApp: (appName) => set({ currentApp: appName }),

  updateTodayTotal: (appName, totalMs) =>
    set((state) => ({
      todayTotals: { ...state.todayTotals, [appName]: totalMs },
      currentApp: appName
    })),

  setTodayTotals: (totals) => {
    const map: Record<string, number> = {}
    for (const t of totals) map[t.app_name] = t.total_ms
    set({ todayTotals: map })
  }
}))
