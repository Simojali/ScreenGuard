import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipcClient'
import type { DowntimeRule } from '../types'

export function useDowntime() {
  const [rules, setRules] = useState<DowntimeRule[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await ipc.getDowntimeRules()
    setRules(data)
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  return { rules, loading, refresh }
}
