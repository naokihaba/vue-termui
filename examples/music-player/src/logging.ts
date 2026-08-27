import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { formatWithOptions } from 'node:util'

const logDirectory = resolve(process.cwd(), 'logs')
export const logPath = resolve(logDirectory, 'music-player.log')

/** Records failures outside the renderer-owned terminal screen. */
export function logError(context: string, cause: unknown): void {
  try {
    mkdirSync(logDirectory, { recursive: true })
    const details = formatWithOptions({ colors: false, depth: 6 }, cause)
    appendFileSync(logPath, `[${new Date().toISOString()}] ERROR ${context}\n${details}\n`)
  } catch {
    // Logging must never replace the original playback error.
  }
}
