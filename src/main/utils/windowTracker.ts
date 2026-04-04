/**
 * Gets the currently focused/foreground window on Windows using a persistent
 * PowerShell process. Uses Win32 APIs via .NET P/Invoke — no native Node addons needed.
 *
 * The PS process is initialized once (takes ~500ms), then each query is ~1ms.
 */
import { spawn, ChildProcess } from 'child_process'

export interface WindowInfo {
  name: string   // process name, e.g. "notepad"
  path: string   // full exe path, e.g. "C:\Windows\System32\notepad.exe"
  title: string  // window title
  pid: number
}

// C# type compiled once inside the persistent PS session
const INIT_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
public class WinTracker {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
    [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder sb, int n);
    public static string GetActive() {
        var h = GetForegroundWindow();
        uint pid = 0;
        GetWindowThreadProcessId(h, out pid);
        var sb = new StringBuilder(512);
        GetWindowText(h, sb, 512);
        try {
            var p = Process.GetProcessById((int)pid);
            string exePath = "";
            try { exePath = p.MainModule != null ? p.MainModule.FileName : ""; } catch {}
            return p.ProcessName + "|" + exePath + "|" + sb.ToString() + "|" + pid;
        } catch { return ""; }
    }
}
"@
Write-Output "INIT_OK"
`

let psProcess: ChildProcess | null = null
let initResolve: (() => void) | null = null
let pendingQuery: { resolve: (r: WindowInfo | null) => void } | null = null

let stdoutBuffer = ''
let initialized = false

function startPersistentPS(): Promise<void> {
  return new Promise((resolve, reject) => {
    initResolve = resolve

    psProcess = spawn(
      'powershell',
      ['-NonInteractive', '-NoProfile', '-Command', '-'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )

    psProcess.stdout!.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString()

      // Process complete lines
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? '' // keep partial last line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        if (!initialized) {
          if (trimmed === 'INIT_OK') {
            initialized = true
            initResolve?.()
            initResolve = null
          }
          continue
        }

        // This line is a query response
        if (pendingQuery) {
          const { resolve: qResolve } = pendingQuery
          pendingQuery = null
          if (!trimmed) {
            qResolve(null)
          } else {
            const [name, path, title, pidStr] = trimmed.split('|')
            if (name) {
              qResolve({ name, path, title, pid: parseInt(pidStr) || 0 })
            } else {
              qResolve(null)
            }
          }
        }
      }
    })

    psProcess.stderr!.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.warn('[windowTracker] PS stderr:', msg)
    })

    psProcess.on('error', (err) => {
      console.error('[windowTracker] PS process error:', err)
      psProcess = null
      initialized = false
      reject(err)
    })

    psProcess.on('exit', () => {
      psProcess = null
      initialized = false
    })

    // Send init script
    psProcess.stdin!.write(INIT_SCRIPT + '\n')
  })
}

async function ensureReady(): Promise<void> {
  if (!psProcess || !initialized) {
    await startPersistentPS()
  }
}

export async function getActiveWindow(): Promise<WindowInfo | null> {
  try {
    await ensureReady()

    return new Promise((resolve) => {
      pendingQuery = { resolve }

      // Timeout after 3 seconds
      const timeout = setTimeout(() => {
        if (pendingQuery) {
          pendingQuery = null
          resolve(null)
        }
      }, 3000)

      // Send query command
      psProcess!.stdin!.write('Write-Output ([WinTracker]::GetActive())\n')

      // Clear timeout once resolved
      const origResolve = resolve
      pendingQuery = {
        resolve: (result) => {
          clearTimeout(timeout)
          origResolve(result)
        }
      }
    })
  } catch (err) {
    console.error('[windowTracker] getActiveWindow error:', err)
    return null
  }
}

export function stopWindowTracker(): void {
  if (psProcess) {
    try { psProcess.stdin!.end() } catch {}
    psProcess = null
    initialized = false
  }
}
