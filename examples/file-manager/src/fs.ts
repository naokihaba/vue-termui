import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

export interface Entry {
  name: string
  path: string
  directory: boolean
  symlink: boolean
  size: number
  modified: Date
}

export const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
export function safePath(root: string, path: string): string {
  const resolved = resolve(path)
  if (resolved !== root && !resolved.startsWith(`${root}/`)) throw new Error('Path escapes root')
  return resolved
}

export async function listDirectory(root: string, path: string, hidden: boolean): Promise<Entry[]> {
  const safe = safePath(root, path)
  const dirents = await readdir(safe, { withFileTypes: true })
  const entries = await Promise.all(
    dirents
      .filter((entry) => hidden || !entry.name.startsWith('.'))
      .map(async (entry) => {
        const entryPath = join(safe, entry.name)
        const info = await stat(entryPath)
        return {
          name: entry.name,
          path: entryPath,
          directory: entry.isDirectory(),
          symlink: entry.isSymbolicLink(),
          size: info.size,
          modified: info.mtime,
        }
      }),
  )
  return entries.sort(
    (a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name),
  )
}

export async function preview(entry: Entry): Promise<string[]> {
  if (entry.directory) return ['Directory', '', 'Press Enter to open.']
  if (entry.symlink) {
    return ['Symbolic link', '', 'Preview disabled to keep navigation inside the root.']
  }
  if (entry.size > 1024 * 1024) {
    return ['Binary or large file', '', `${formatSize(entry.size)}`]
  }
  try {
    const buffer = await readFile(entry.path)
    if (buffer.includes(0)) return ['Binary file', '', `${formatSize(entry.size)}`]
    return buffer.toString('utf8').split('\n').slice(0, 120)
  } catch (cause) {
    return [cause instanceof Error ? cause.message : String(cause)]
  }
}

export function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 ** 2).toFixed(1)} MB`
}

export function relativePath(root: string, path: string): string {
  return relative(root, path) || '.'
}
