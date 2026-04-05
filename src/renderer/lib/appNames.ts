/** Maps process names (lowercase, no .exe, no UWP suffixes) to human-friendly display names */
const KNOWN_NAMES: Record<string, string> = {
  // Browsers
  'chrome': 'Google Chrome',
  'firefox': 'Firefox',
  'msedge': 'Microsoft Edge',
  'opera': 'Opera',
  'brave': 'Brave',
  'vivaldi': 'Vivaldi',
  'arc': 'Arc',
  // Dev tools
  'code': 'VS Code',
  'code - insiders': 'VS Code Insiders',
  'cursor': 'Cursor',
  'devenv': 'Visual Studio',
  'rider': 'Rider',
  'idea64': 'IntelliJ IDEA',
  'webstorm64': 'WebStorm',
  'pycharm64': 'PyCharm',
  'windowsterminal': 'Windows Terminal',
  'wt': 'Windows Terminal',
  'powershell': 'PowerShell',
  'cmd': 'Command Prompt',
  'notepad': 'Notepad',
  'notepad++': 'Notepad++',
  'postman': 'Postman',
  'gitkraken': 'GitKraken',
  'sourcetree': 'Sourcetree',
  'dockerdesktop': 'Docker Desktop',
  // System
  'explorer': 'File Explorer',
  'taskmgr': 'Task Manager',
  'regedit': 'Registry Editor',
  'mspaint': 'Paint',
  'calc': 'Calculator',
  // Communication
  'slack': 'Slack',
  'discord': 'Discord',
  'teams': 'Microsoft Teams',
  'zoom': 'Zoom',
  'telegram': 'Telegram',
  'whatsapp': 'WhatsApp',
  'whatsapp.root': 'WhatsApp',         // UWP / Store process name
  'whatsappdesktop': 'WhatsApp',
  'signal': 'Signal',
  'skype': 'Skype',
  'element': 'Element',
  'viber': 'Viber',
  'mattermost': 'Mattermost',
  // Productivity
  'winword': 'Microsoft Word',
  'excel': 'Microsoft Excel',
  'powerpnt': 'PowerPoint',
  'outlook': 'Outlook',
  'onenote': 'OneNote',
  'notion': 'Notion',
  'obsidian': 'Obsidian',
  'evernote': 'Evernote',
  'todoist': 'Todoist',
  'trello': 'Trello',
  'acrobat': 'Adobe Acrobat',
  'acrord32': 'Adobe Acrobat Reader',
  'foxitreader': 'Foxit Reader',
  // Media
  'spotify': 'Spotify',
  'vlc': 'VLC',
  'wmplayer': 'Windows Media Player',
  'foobar2000': 'foobar2000',
  'musicbee': 'MusicBee',
  'mpv': 'mpv',
  'plex': 'Plex',
  'potplayer': 'PotPlayer',
  // Creative
  'photoshop': 'Photoshop',
  'illustrator': 'Illustrator',
  'afterfx': 'After Effects',
  'premiere pro': 'Adobe Premiere Pro',
  'premierepro': 'Adobe Premiere Pro',
  'adobe premiere pro': 'Adobe Premiere Pro',
  'resolve': 'DaVinci Resolve',
  'davinci resolve': 'DaVinci Resolve',
  'blender': 'Blender',
  'figma': 'Figma',
  'audacity': 'Audacity',
  'gimp': 'GIMP',
  'krita': 'Krita',
  'inkscape': 'Inkscape',
  'capcut': 'CapCut',
  'obs64': 'OBS Studio',
  'obs32': 'OBS Studio',
  'obs': 'OBS Studio',
  // Gaming
  'steam': 'Steam',
  'epicgameslauncher': 'Epic Games Launcher',
  // Dev runtimes (not user-facing, but may appear)
  'node': 'Node.js',
  'python': 'Python',
  'pythonw': 'Python',
  // AI / other
  'claude': 'Claude',
}

/**
 * Returns a human-friendly display name for an app.
 * - Strips .exe suffix
 * - Strips common UWP package suffixes (.Root, .Desktop, .App)
 * - Looks up the known-names map, falling back to the cleaned name.
 */
export function friendlyName(appName: string): string {
  // Strip .exe
  let name = appName.replace(/\.exe$/i, '')
  // Strip UWP process suffixes: .Root, .Desktop, .App (case-insensitive)
  name = name.replace(/\.(Root|Desktop|App)$/i, '')
  const lower = name.toLowerCase()
  return KNOWN_NAMES[lower] ?? name
}
