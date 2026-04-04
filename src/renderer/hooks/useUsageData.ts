import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipcClient'
import { useAppStore } from '../store/appStore'
import type { DailyTotal } from '../types'

export function useUsageData(date?: string) {
  const [totals, setTotals] = useState<DailyTotal[]>([])
  const [loading, setLoading] = useState(true)
  const setTodayTotals = useAppStore((s) => s.setTodayTotals)

  const refresh = useCallback(async () => {
    const data = await ipc.getToday(date)
    setTotals(data)
    if (!date) setTodayTotals(data)
  }, [date, setTodayTotals])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))

    // Refresh every 30 seconds
    const timer = setInterval(refresh, 30000)
    return () => clearInterval(timer)
  }, [refresh])

  return { totals, loading, refresh }
}
