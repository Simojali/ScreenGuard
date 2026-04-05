import { create } from 'zustand'
import type { DailyTotal } from '../types'

export type Theme = 'dark' | 'light'

interface AppState {
  currentApp: string | null
  todayTotals: Record<string, number>
  theme: Theme
  categoryOverrides: Record<string, string>  // appName → categoryId
  categoryLabels: Record<string, string>     // categoryId → custom label
  setCurrentApp: (appName: string | null) => void
  updateTodayTotal: (appName: string, totalMs: number) => void
  setTodayTotals: (totals: DailyTotal[]) => void
  toggleTheme: () => void
  setCategoryOverrides: (overrides: Record<string, string>) => void
  setCategoryLabels: (labels: Record<string, string>) => void
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

const savedTheme = (localStorage.getItem('sg-theme') as Theme) ?? 'dark'
applyTheme(savedTheme)

export const useAppStore = create<AppState>((set) => ({
  currentApp: null,
  todayTotals: {},
  theme: savedTheme,
  categoryOverrides: {},
  categoryLabels: {},

  setCurrentApp: (appName) => set({ currentApp: appName }),

  updateTodayTotal: (appName, totalMs) =>
    set((state) => ({
      todayTotals: { ...state.todayTotals, [appName]: totalMs },
      currentApp: appName,
    })),

  setTodayTotals: (totals) => {
    const map: Record<string, number> = {}
    for (const t of totals) map[t.app_name] = t.total_ms
    set({ todayTotals: map })
  },

  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('sg-theme', next)
      applyTheme(next)
      return { theme: next }
    }),

  setCategoryOverrides: (overrides) => set({ categoryOverrides: overrides }),
  setCategoryLabels: (labels) => set({ categoryLabels: labels }),
}))
