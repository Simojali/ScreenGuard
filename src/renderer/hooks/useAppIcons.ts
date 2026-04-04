import { useState, useEffect, useRef } from 'react'
import { ipc } from '../lib/ipcClient'

// Module-level cache so icons persist across re-renders and route changes
const iconCache: Record<string, string | null> = {}

export function useAppIcons(exePaths: string[]): Record<string, string | null> {
  const [icons, setIcons] = useState<Record<string, string | null>>({})
  const fetching = useRef(new Set<string>())

  useEffect(() => {
    const missing = exePaths.filter(
      (p) => p && !(p in iconCache) && !fetching.current.has(p)
    )
    if (missing.length === 0) {
      // All already cached — just sync state
      setIcons({ ...iconCache })
      return
    }

    missing.forEach((p) => fetching.current.add(p))

    Promise.all(
      missing.map((p) =>
        ipc.getAppIcon(p)
          .then((dataUrl) => {
            iconCache[p] = dataUrl ?? null
            fetching.current.delete(p)
          })
          .catch(() => {
            iconCache[p] = null
            fetching.current.delete(p)
          })
      )
    ).then(() => {
      setIcons({ ...iconCache })
    })
  }, [exePaths.join('|')])  // eslint-disable-line react-hooks/exhaustive-deps

  return icons
}
