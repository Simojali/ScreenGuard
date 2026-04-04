import { app, BrowserWindow, powerMonitor } from 'electron'
import path from 'path'
import { initDatabase } from './db/database'
import { startTracker, stopTracker } from './modules/tracker'
import { startLimiter, stopLimiter } from './modules/limiter'
import { startDowntime, stopDowntime } from './modules/downtime'
import { setupTray } from './modules/tray'
import { initIpcHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    show: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'ScreenGuard',
    icon: path.join(__dirname, '../../resources/tray-icon.png')
  })

  // Hide window instead of quitting when user closes it
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  // electron-vite sets ELECTRON_RENDERER_URL automatically in dev mode
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  // Enable Windows toast notifications
  app.setAppUserModelId('com.screenguard.app')

  // Auto-start with Windows (only in production)
  if (process.env['NODE_ENV'] !== 'development') {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
  }

  const db = await initDatabase()
  mainWindow = createWindow()

  setupTray(mainWindow)
  initIpcHandlers(db)
  startTracker(db, mainWindow)
  startLimiter(db, mainWindow)
  startDowntime(db)

  // Handle system suspend/resume
  powerMonitor.on('suspend', () => {
    stopTracker()
  })
  powerMonitor.on('resume', () => {
    if (mainWindow) startTracker(db, mainWindow)
  })
})

app.on('before-quit', () => {
  isQuitting = true
  stopTracker()
  stopLimiter()
  stopDowntime()
})

// Prevent quitting when all windows close — live in tray instead
app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
})
