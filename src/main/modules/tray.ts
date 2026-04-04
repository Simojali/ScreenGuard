import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron'
import path from 'path'

let tray: Tray | null = null

export function setupTray(window: BrowserWindow): Tray {
  // Use a built-in icon as fallback if custom icon doesn't exist
  const iconPath = path.join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('ScreenGuard')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => showWindow(window)
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    toggleWindow(window)
  })

  return tray
}

export function updateTrayTooltip(todayTotalMs: number): void {
  if (!tray) return
  const hours = Math.floor(todayTotalMs / 3600000)
  const minutes = Math.floor((todayTotalMs % 3600000) / 60000)
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  tray.setToolTip(`ScreenGuard — Today: ${timeStr}`)
}

function showWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function toggleWindow(window: BrowserWindow): void {
  if (window.isVisible()) {
    window.hide()
  } else {
    showWindow(window)
  }
}
