import React, { useState, useEffect, useRef, useMemo } from 'react'
import { RotateCcw, Plus, X, GripVertical, Check, Pencil, FolderOpen } from 'lucide-react'
import { ipc } from '../lib/ipcClient'
import { CATEGORIES, getCategoryId, resolveCategoryId, resolveLabel } from '../lib/categories'
import { friendlyName } from '../lib/appNames'
import { useCategoryManager } from '../hooks/useCategoryManager'
import type { KnownApp } from '../types'

/* ─── types ─────────────────────────────────────────────────────────────── */

type AppEntry = KnownApp & { defaultCatId: string; isOverridden: boolean }

/* ─── helpers ───────────────────────────────────────────────────────────── */

function sortName(a: AppEntry) { return friendlyName(a.app_name).toLowerCase() }

/* ═══════════════════════════════════════════════════════════════════════════
   CategoriesPage
═══════════════════════════════════════════════════════════════════════════ */

export default function CategoriesPage(): React.ReactElement {
  const { overrides, labels, moveApp, removeFromCategory, renameCategory, resetCategoryLabel, resetCategoryToDefaults } =
    useCategoryManager()

  const [knownApps, setKnownApps] = useState<KnownApp[]>([])

  // drag state
  const [dragApp, setDragApp]       = useState<{ appName: string; fromCatId: string } | null>(null)
  const [dragOverCat, setDragOverCat] = useState<string | null>(null)

  // inline label editing
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editValue, setEditValue]   = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // add-app dropdown per category
  const [addingTo, setAddingTo] = useState<string | null>(null)

  useEffect(() => { ipc.getKnownApps().then(setKnownApps) }, [])
  useEffect(() => {
    if (editingCat) setTimeout(() => editInputRef.current?.focus(), 30)
  }, [editingCat])

  /* ── derived: apps grouped by effective category ── */
  const appsByCategory = useMemo<Record<string, AppEntry[]>>(() => {
    const result: Record<string, AppEntry[]> = {}
    for (const cat of CATEGORIES) result[cat.id] = []

    for (const app of knownApps) {
      const defaultCatId   = getCategoryId(app.app_name)
      const effectiveCatId = resolveCategoryId(app.app_name, overrides)
      const isOverridden   = effectiveCatId !== defaultCatId
      const bucket         = result[effectiveCatId] ?? result['other']
      bucket.push({ ...app, defaultCatId, isOverridden })
    }

    // Sort each bucket alphabetically
    for (const id of Object.keys(result)) {
      result[id].sort((a, b) => sortName(a).localeCompare(sortName(b)))
    }
    return result
  }, [knownApps, overrides])

  /* ── all app names for reset checks ── */
  const allAppNames = knownApps.map((a) => a.app_name)

  /* ── drag handlers ── */
  function onDragStart(appName: string, fromCatId: string) {
    setDragApp({ appName, fromCatId })
  }
  function onDragOver(e: React.DragEvent, catId: string) {
    e.preventDefault()
    setDragOverCat(catId)
  }
  function onDragLeave() { setDragOverCat(null) }
  async function onDrop(e: React.DragEvent, targetCatId: string) {
    e.preventDefault()
    setDragOverCat(null)
    if (!dragApp || dragApp.fromCatId === targetCatId) { setDragApp(null); return }
    await moveApp(dragApp.appName, targetCatId)
    setDragApp(null)
  }
  function onDragEnd() { setDragApp(null); setDragOverCat(null) }

  /* ── label editing ── */
  function startEdit(catId: string, currentLabel: string) {
    setEditingCat(catId)
    setEditValue(currentLabel)
    setAddingTo(null)
  }
  async function commitEdit(catId: string) {
    const defaultLabel = CATEGORIES.find((c) => c.id === catId)?.label ?? ''
    if (editValue.trim() && editValue.trim() !== defaultLabel) {
      await renameCategory(catId, editValue.trim())
    } else if (editValue.trim() === defaultLabel) {
      await resetCategoryLabel(catId)
    }
    setEditingCat(null)
  }

  /* ── "add app" picker ── */
  function appsNotInCat(catId: string): AppEntry[] {
    return knownApps
      .map((a) => ({
        ...a,
        defaultCatId: getCategoryId(a.app_name),
        isOverridden: resolveCategoryId(a.app_name, overrides) !== getCategoryId(a.app_name),
      }))
      .filter((a) => resolveCategoryId(a.app_name, overrides) !== catId)
      .sort((a, b) => sortName(a).localeCompare(sortName(b)))
  }

  /* ── styles ── */
  const pill: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 6px',
    borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-row)',
    fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
  }

  /* ═══════ render ═══════ */
  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Categories</h1>
        <button
          onClick={async () => {
            await Promise.all([
              ipc.resetCategoryOverrides('__all__'),   // no-op but safe
              ...CATEGORIES.map((c) => resetCategoryToDefaults(c.id, allAppNames)),
            ])
            await Promise.all(CATEGORIES.map((c) => resetCategoryLabel(c.id)))
          }}
          style={{ ...pill, color: 'var(--text-2)' }}
          title="Reset all categories and labels to defaults"
        >
          <RotateCcw size={13} /> Reset all
        </button>
      </div>

      {knownApps.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 60, fontSize: 14, lineHeight: 1.8 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏷️</div>
          No apps tracked yet.<br />
          Use your computer and come back to customise categories.
        </div>
      )}

      {/* Category cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CATEGORIES.map((cat) => {
          const apps        = appsByCategory[cat.id] ?? []
          const isDragTarget = dragOverCat === cat.id && dragApp?.fromCatId !== cat.id
          const currentLabel = resolveLabel(cat.id, labels)
          const isRenamed    = !!labels[cat.id]
          const isEditing    = editingCat === cat.id
          const isAddingHere = addingTo === cat.id

          return (
            <div
              key={cat.id}
              onDragOver={(e) => onDragOver(e, cat.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, cat.id)}
              style={{
                background: 'var(--bg-card)', border: `1.5px solid ${isDragTarget ? cat.color : 'var(--border)'}`,
                borderRadius: 12, overflow: 'hidden',
                boxShadow: isDragTarget ? `0 0 0 2px ${cat.color}33` : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              {/* ── Card header ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
                {/* Color dot + icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: cat.color + '22', border: `1.5px solid ${cat.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {cat.icon}
                </div>

                {/* Editable label */}
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(cat.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(cat.id)
                      if (e.key === 'Escape') setEditingCat(null)
                    }}
                    style={{
                      flex: 1, background: 'var(--bg-row)', border: `1px solid ${cat.color}`,
                      borderRadius: 6, color: 'var(--text-1)', padding: '4px 8px',
                      fontSize: 14, fontWeight: 600, outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-1)', cursor: 'text' }}
                    onDoubleClick={() => startEdit(cat.id, currentLabel)}
                    title="Double-click to rename"
                  >
                    {currentLabel}
                    {isRenamed && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: cat.color, fontWeight: 400 }}>
                        (renamed)
                      </span>
                    )}
                  </span>
                )}

                {/* App count */}
                <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
                  {apps.length} {apps.length === 1 ? 'app' : 'apps'}
                </span>

                {/* Edit label button */}
                {!isEditing && (
                  <button
                    onClick={() => startEdit(cat.id, currentLabel)}
                    title="Rename category"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4, display: 'flex' }}
                  >
                    <Pencil size={13} />
                  </button>
                )}

                {/* Confirm edit */}
                {isEditing && (
                  <button
                    onClick={() => commitEdit(cat.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: cat.color, padding: 4, display: 'flex' }}
                  >
                    <Check size={14} />
                  </button>
                )}

                {/* Reset category */}
                <button
                  onClick={async () => {
                    await resetCategoryToDefaults(cat.id, allAppNames)
                    if (isRenamed) await resetCategoryLabel(cat.id)
                  }}
                  title="Reset this category to defaults"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4, display: 'flex' }}
                >
                  <RotateCcw size={13} />
                </button>
              </div>

              {/* ── App list ── */}
              {apps.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {apps.map((app) => (
                    <div
                      key={app.app_name}
                      draggable
                      onDragStart={() => onDragStart(app.app_name, cat.id)}
                      onDragEnd={onDragEnd}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderBottom: '1px solid var(--bg-row)',
                        background: 'transparent', cursor: 'grab',
                        opacity: dragApp?.appName === app.app_name ? 0.4 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <GripVertical size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)' }}>
                        {friendlyName(app.app_name)}
                      </span>
                      {app.isOverridden && (
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 4,
                          background: cat.color + '22', color: cat.color,
                        }}>
                          moved
                        </span>
                      )}
                      <button
                        onClick={() => removeFromCategory(app.app_name)}
                        title="Remove from this category"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 2, display: 'flex' }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Add app ── */}
              <div style={{ padding: '8px 16px', borderTop: apps.length > 0 ? '1px solid var(--border)' : undefined }}>
                {isAddingHere ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        autoFocus
                        defaultValue=""
                        onChange={async (e) => {
                          if (e.target.value) {
                            await moveApp(e.target.value, cat.id)
                            setAddingTo(null)
                          }
                        }}
                        style={{
                          flex: 1, background: 'var(--bg-row)', border: '1px solid var(--border-hi)',
                          borderRadius: 7, color: 'var(--text-1)', padding: '6px 8px', fontSize: 13,
                        }}
                      >
                        <option value="" disabled>Select a tracked app…</option>
                        {appsNotInCat(cat.id).map((a) => (
                          <option key={a.app_name} value={a.app_name}>
                            {friendlyName(a.app_name)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setAddingTo(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {/* Browse button */}
                    <button
                      onClick={async () => {
                        const picked = await ipc.pickExe()
                        if (!picked) return
                        // Add to knownApps if not already tracked
                        setKnownApps((prev) =>
                          prev.some((a) => a.app_name === picked.app_name) ? prev : [...prev, picked]
                        )
                        await moveApp(picked.app_name, cat.id)
                        setAddingTo(null)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'none', border: '1px dashed var(--border-hi)', borderRadius: 7,
                        color: 'var(--text-3)', padding: '5px 10px', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      <FolderOpen size={13} /> Browse for app…
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingTo(cat.id); setEditingCat(null) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-3)', fontSize: 12, padding: 0,
                    }}
                  >
                    <Plus size={13} /> Add app
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
