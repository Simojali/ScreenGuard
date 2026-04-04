import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipcClient'
import type { AppLimit } from '../types'

export function useLimits() {
  const [limits, setLimits] = useState<AppLimit[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await ipc.getLimits()
    setLimits(data)
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  return { limits, loading, refresh }
}
