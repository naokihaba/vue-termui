import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { env } from 'node:process'

export type ProjectOwnerKind = 'orgs' | 'users'

export interface ConnectedProject {
  id: string
  owner: string
  ownerKind: ProjectOwnerKind
  number: number
  title: string
  url: string
}

interface ConfigFile {
  projects: ConnectedProject[]
}

function configPath(): string {
  if (env.VUEBOARD_CONFIG) return env.VUEBOARD_CONFIG
  const configRoot = env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(configRoot, 'vue-termui', 'kanban.json')
}

export function loadProjects(): ConnectedProject[] {
  const path = configPath()
  if (!existsSync(path)) return []
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ConfigFile
    return Array.isArray(parsed.projects) ? parsed.projects : []
  } catch {
    return []
  }
}

export function saveProjects(projects: ConnectedProject[]): void {
  const path = configPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ projects } satisfies ConfigFile, null, 2)}\n`, {
    mode: 0o600,
  })
}

export function projectId(ownerKind: ProjectOwnerKind, owner: string, number: number): string {
  return `${ownerKind === 'orgs' ? 'o' : 'u'}-${owner.toLowerCase()}-${number}`
}

export function parseProjectUrl(value: string): Omit<ConnectedProject, 'id' | 'title'> {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Enter a GitHub project URL such as https://github.com/orgs/vuejs/projects/1')
  }

  const match = url.pathname.match(/^\/(orgs|users)\/([^/]+)\/projects\/(\d+)\/?$/)
  if (url.hostname !== 'github.com' || !match) {
    throw new Error('Only GitHub Projects v2 URLs are supported')
  }

  const ownerKind = match[1] as ProjectOwnerKind
  const owner = decodeURIComponent(match[2]!)
  const number = Number(match[3])
  return {
    owner,
    ownerKind,
    number,
    url: `https://github.com/${ownerKind}/${owner}/projects/${number}`,
  }
}
