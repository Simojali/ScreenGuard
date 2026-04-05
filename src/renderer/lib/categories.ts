export type Category = {
  id: string
  label: string
  icon: string
  color: string
}

export const CATEGORIES: Category[] = [
  { id: 'web',          label: 'Web & Browsing',       icon: '🌐', color: '#38bdf8' },
  { id: 'productivity', label: 'Productivity',          icon: '💼', color: '#34d399' },
  { id: 'communication',label: 'Communication',         icon: '💬', color: '#7c8cf8' },
  { id: 'gaming',       label: 'Gaming',                icon: '🎮', color: '#f59e0b' },
  { id: 'media',        label: 'Media & Entertainment', icon: '🎵', color: '#fb7185' },
  { id: 'creative',     label: 'Creative',              icon: '🎨', color: '#a78bfa' },
  { id: 'development',  label: 'Development',           icon: '💻', color: '#22d3ee' },
  { id: 'system',       label: 'System & Utilities',    icon: '🔧', color: '#94a3b8' },
  { id: 'other',        label: 'Other',                 icon: '📦', color: '#64748b' },
]

const CATEGORY_MAP: Record<string, string> = {
  // Web & Browsing
  chrome: 'web', msedge: 'web', firefox: 'web', brave: 'web',
  opera: 'web', vivaldi: 'web', iexplore: 'web', waterfox: 'web',
  librewolf: 'web', thorium: 'web', arc: 'web',

  // Productivity
  winword: 'productivity', excel: 'productivity', powerpnt: 'productivity',
  outlook: 'productivity', onenote: 'productivity', notion: 'productivity',
  obsidian: 'productivity', evernote: 'productivity', acrobat: 'productivity',
  acrord32: 'productivity', foxitreader: 'productivity', thunderbird: 'productivity',
  todoist: 'productivity', trello: 'productivity', asana: 'productivity',

  // Communication
  teams: 'communication', slack: 'communication', discord: 'communication',
  zoom: 'communication', telegram: 'communication', whatsapp: 'communication',
  messenger: 'communication', skype: 'communication', signal: 'communication',
  element: 'communication', viber: 'communication', lync: 'communication',
  line: 'communication', mattermost: 'communication',

  // Gaming
  steam: 'gaming', epicgameslauncher: 'gaming', origin: 'gaming',
  battlenet: 'gaming', gog: 'gaming', playnite: 'gaming', parsec: 'gaming',
  xboxapp: 'gaming', gamebarft: 'gaming',

  // Media & Entertainment
  spotify: 'media', vlc: 'media', wmplayer: 'media', foobar2000: 'media',
  itunes: 'media', musicbee: 'media', mpv: 'media', plex: 'media',
  jellyfin: 'media', potplayer: 'media', groovemusicapp: 'media',
  films: 'media',

  // Creative
  photoshop: 'creative', illustrator: 'creative', premiere: 'creative',
  afterfx: 'creative', blender: 'creative', figma: 'creative',
  resolve: 'creative', audacity: 'creative', lightroom: 'creative',
  gimp: 'creative', inkscape: 'creative', krita: 'creative',
  capcut: 'creative', vegas: 'creative', davinci: 'creative',
  'clip studio paint': 'creative',

  // Development
  code: 'development', devenv: 'development', rider: 'development',
  idea64: 'development', webstorm64: 'development', pycharm64: 'development',
  clion64: 'development', goland64: 'development', fleet: 'development',
  atom: 'development', sublime_text: 'development', notepad: 'development',
  wt: 'development', powershell: 'development', cmd: 'development',
  windowsterminal: 'development', gitkraken: 'development',
  sourcetree: 'development', postman: 'development', insomnia: 'development',
  dbeaver: 'development', dockerdesktop: 'development', datagrip64: 'development',

  // System & Utilities
  explorer: 'system', taskmgr: 'system', regedit: 'system',
  mmc: 'system', dxdiag: 'system', '7zfm': 'system', winrar: 'system',
  everything: 'system', perfmon: 'system', resmon: 'system',
  powertoys: 'system', autoruns: 'system', procexp: 'system',
}

/** Default category ID from the built-in map */
export function getCategoryId(appName: string): string {
  const key = appName.replace(/\.exe$/i, '').toLowerCase()
  return CATEGORY_MAP[key] ?? 'other'
}

/** Category ID respecting user overrides */
export function resolveCategoryId(appName: string, overrides: Record<string, string>): string {
  return overrides[appName] ?? getCategoryId(appName)
}

/** Full Category object respecting overrides */
export function resolveCategory(appName: string, overrides: Record<string, string>): Category {
  const id = resolveCategoryId(appName, overrides)
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}

/** Display label respecting custom labels */
export function resolveLabel(categoryId: string, customLabels: Record<string, string>): string {
  return customLabels[categoryId] ?? CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId
}
