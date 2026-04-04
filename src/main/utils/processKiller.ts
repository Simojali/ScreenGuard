import { execFile } from 'child_process'
import path from 'path'

/**
 * Force-kills a process by its executable filename (e.g. "Notepad.exe").
 * Uses taskkill /f /im <name> /t to kill the image and all child processes.
 * No elevation required for same-user processes.
 */
export function killProcessByName(exeName: string): Promise<void> {
  // taskkill requires the .exe suffix — add it if the caller omitted it
  let name = path.basename(exeName)
  if (!name.toLowerCase().endsWith('.exe')) name += '.exe'
  return new Promise((resolve) => {
    execFile('taskkill', ['/f', '/im', name, '/t'], (err) => {
      // "not found" means the process already exited — treat as success
      if (err && !err.message.includes('not found') && !err.message.includes('No tasks')) {
        console.warn(`[processKiller] taskkill failed for ${name}:`, err.message)
      }
      resolve()
    })
  })
}

/**
 * Force-kills a process by its PID.
 */
export function killProcessByPid(pid: number): Promise<void> {
  return new Promise((resolve) => {
    execFile('taskkill', ['/f', '/pid', String(pid), '/t'], (err) => {
      if (err && !err.message.includes('not found') && !err.message.includes('No tasks')) {
        console.warn(`[processKiller] taskkill failed for PID ${pid}:`, err.message)
      }
      resolve()
    })
  })
}
