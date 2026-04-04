/** Maps process names (lowercase, no .exe) to human-friendly display names */
const KNOWN_NAMES: Record<string, string> = {
  'chrome': 'Google Chrome',
  'firefox': 'Firefox',
  'msedge': 'Microsoft Edge',
  'opera': 'Opera',
  'brave': 'Brave',
  'code': 'VS Code',
  'code - insiders': 'VS Code Insiders',
  'explorer': 'File Explorer',
  'cmd': 'Command Prompt',
  'powershell': 'PowerShell',
  'windowsterminal': 'Windows Terminal',
  'wt': 'Windows Terminal',
  'notepad': 'Notepad',
  'notepad++': 'Notepad++',
  'mspaint': 'Paint',
  'calc': 'Calculator',
  'slack': 'Slack',
  'discord': 'Discord',
  'teams': 'Microsoft Teams',
  'zoom': 'Zoom',
  'spotify': 'Spotify',
  'vlc': 'VLC',
  'steam': 'Steam',
  'node': 'Node.js',
  'python': 'Python',
  'pythonw': 'Python',
  'claude': 'Claude',
  'cursor': 'Cursor',
  'figma': 'Figma',
  'photoshop': 'Photoshop',
  'illustrator': 'Illustrator',
  'afterfx': 'After Effects',
  'premierepro': 'Premiere Pro',
  'adobe premiere pro': 'Adobe Premiere Pro',
  'acrobat': 'Adobe Acrobat',
  'winword': 'Microsoft Word',
  'excel': 'Microsoft Excel',
  'powerpnt': 'PowerPoint',
  'outlook': 'Outlook',
  'onenote': 'OneNote',
  'taskmgr': 'Task Manager',
  'regedit': 'Registry Editor',
  'obs64': 'OBS Studio',
  'obs32': 'OBS Studio',
}

/**
 * Returns a human-friendly display name for an app.
 * Strips .exe (handles legacy DB entries that stored names with .exe),
 * then looks up the known names map, falling back to the stripped name.
 */
export function friendlyName(appName: string): string {
  const stripped = appName.replace(/\.exe$/i, '')
  const lower = stripped.toLowerCase()
  return KNOWN_NAMES[lower] ?? stripped
}
