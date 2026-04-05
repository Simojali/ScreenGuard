import { useEffect } from 'react'
import { ipc } from '../lib/ipcClient'
import { getCategoryId } from '../lib/categories'
import { useAppStore } from '../store/appStore'

export function useCategoryManager() {
  const overrides = useAppStore((s) => s.categoryOverrides)
  const labels    = useAppStore((s) => s.categoryLabels)
  const setOverrides = useAppStore((s) => s.setCategoryOverrides)
  const setLabels    = useAppStore((s) => s.setCategoryLabels)

  // Load from DB on mount
  useEffect(() => {
    Promise.all([ipc.getCategoryOverrides(), ipc.getCategoryLabels()]).then(
      ([overrideRows, labelRows]) => {
        const om: Record<string, string> = {}
        for (const r of overrideRows) om[r.app_name] = r.category_id
        setOverrides(om)

        const lm: Record<string, string> = {}
        for (const r of labelRows) lm[r.category_id] = r.label
        setLabels(lm)
      }
    )
  }, [])

  /** Move an app to a new category. Removes the override if target == default. */
  async function moveApp(appName: string, targetCategoryId: string) {
    const defaultCatId = getCategoryId(appName)
    if (targetCategoryId === defaultCatId) {
      await ipc.removeCategoryOverride(appName)
      const { [appName]: _, ...rest } = overrides
      setOverrides(rest)
    } else {
      await ipc.setCategoryOverride(appName, targetCategoryId)
      setOverrides({ ...overrides, [appName]: targetCategoryId })
    }
  }

  /** Remove app from its current (overridden) category — sends it to 'other'. */
  async function removeFromCategory(appName: string) {
    const defaultCatId = getCategoryId(appName)
    if (defaultCatId === 'other') {
      // Already other by default — just remove any override
      await ipc.removeCategoryOverride(appName)
      const { [appName]: _, ...rest } = overrides
      setOverrides(rest)
    } else {
      // Force to 'other'
      await ipc.setCategoryOverride(appName, 'other')
      setOverrides({ ...overrides, [appName]: 'other' })
    }
  }

  /** Rename a category. Pass the default label to reset instead of rename. */
  async function renameCategory(categoryId: string, newLabel: string) {
    await ipc.setCategoryLabel(categoryId, newLabel)
    setLabels({ ...labels, [categoryId]: newLabel })
  }

  /** Reset a category's custom label back to default. */
  async function resetCategoryLabel(categoryId: string) {
    await ipc.resetCategoryLabel(categoryId)
    const { [categoryId]: _, ...rest } = labels
    setLabels(rest)
  }

  /**
   * Reset all overrides that point TO this category (moved-in apps go back
   * to their defaults), plus native apps moved OUT go back.
   */
  async function resetCategoryToDefaults(categoryId: string, appNames: string[]) {
    // 1. Remove overrides pointing TO this category
    await ipc.resetCategoryOverrides(categoryId)

    // 2. Remove overrides for apps whose DEFAULT is this category
    //    (they were moved out — restore them)
    const nativesMoved = appNames.filter(
      (a) => getCategoryId(a) === categoryId && overrides[a] && overrides[a] !== categoryId
    )
    await Promise.all(nativesMoved.map((a) => ipc.removeCategoryOverride(a)))

    // Rebuild overrides in store
    const next = { ...overrides }
    for (const a of Object.keys(next)) {
      if (next[a] === categoryId) delete next[a]
    }
    for (const a of nativesMoved) delete next[a]
    setOverrides(next)
  }

  return { overrides, labels, moveApp, removeFromCategory, renameCategory, resetCategoryLabel, resetCategoryToDefaults }
}
