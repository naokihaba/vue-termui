import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

const apiUrl = 'https://api.spotify.com/v1'
const playerUrl = `${apiUrl}/me/player`
const accountsUrl = 'https://accounts.spotify.com/api/token'

interface StoredToken {
  clientId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface Track {
  id: string
  uri: string
  name: string
  artist: string
  album: string
  duration: number
  image?: string
}

export interface PlayerState {
  track: Track | null
  progress: number
  playing: boolean
  shuffle: boolean
  repeat: 'off' | 'context' | 'track'
  device: string
  volume: number
}

interface SpotifyImage {
  url: string
}

interface SpotifyTrack {
  id: string
  uri: string
  type?: string
  name: string
  duration_ms: number
  artists: Array<{ name: string }>
  album: { name: string; images: SpotifyImage[] }
}

interface SpotifyPlayback {
  item: SpotifyTrack | null
  progress_ms: number | null
  is_playing: boolean
  shuffle_state: boolean
  repeat_state: PlayerState['repeat']
  device: { name: string; volume_percent: number }
}

interface SpotifyQueue {
  queue: SpotifyTrack[]
}

interface SpotifySearch {
  tracks: { items: SpotifyTrack[] }
}

interface SpotifySavedTracks {
  items: Array<{ track: SpotifyTrack }>
}

interface SpotifyErrorBody {
  error?:
    | string
    | {
        message?: string
        reason?: string
        status?: number
      }
  error_description?: string
}

export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly details?: string,
  ) {
    const endpoint = path || '/state'
    super(`Spotify ${method} ${endpoint} failed (${status})${details ? `: ${details}` : ''}`)
    this.name = 'SpotifyApiError'
  }
}

async function responseErrorDetails(response: Response): Promise<string | undefined> {
  const body = await response.text()
  if (!body) return response.statusText || undefined

  try {
    const result = JSON.parse(body) as SpotifyErrorBody
    if (typeof result.error === 'string') {
      return result.error_description
        ? `${result.error}: ${result.error_description}`
        : result.error
    }
    if (result.error && typeof result.error === 'object') {
      return [result.error.message, result.error.reason].filter(Boolean).join(' — ') || body
    }
  } catch {
    // Spotify occasionally returns plain text or an intermediary HTML response.
  }
  return body.replace(/\s+/g, ' ').trim().slice(0, 500)
}

function toTrack(item: SpotifyTrack): Track {
  return {
    id: item.id,
    uri: item.uri,
    name: item.name,
    artist: item.artists.map((artist) => artist.name).join(', '),
    album: item.album.name,
    duration: item.duration_ms,
    ...(item.album.images[0]?.url ? { image: item.album.images[0].url } : {}),
  }
}

export class SpotifyClient {
  private constructor(
    private token: string,
    private readonly stored?: StoredToken,
  ) {}

  static create(): SpotifyClient | null {
    const environmentToken = process.env.SPOTIFY_ACCESS_TOKEN
    if (environmentToken) return new SpotifyClient(environmentToken)

    try {
      const stored = JSON.parse(readFileSync('.spotify-token.json', 'utf8')) as StoredToken
      return new SpotifyClient(stored.accessToken, stored)
    } catch {
      return null
    }
  }

  private async refreshIfNeeded(): Promise<void> {
    if (!this.stored || Date.now() < this.stored.expiresAt - 30_000) return
    const response = await fetch(accountsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.stored.refreshToken,
        client_id: this.stored.clientId,
      }),
    })
    if (!response.ok) throw new Error(`Spotify token refresh failed (${response.status})`)
    const result = (await response.json()) as {
      access_token: string
      expires_in: number
      refresh_token?: string
    }
    this.token = result.access_token
    this.stored.accessToken = result.access_token
    this.stored.expiresAt = Date.now() + result.expires_in * 1000
    if (result.refresh_token) this.stored.refreshToken = result.refresh_token
    await writeFile('.spotify-token.json', `${JSON.stringify(this.stored, null, 2)}\n`, {
      mode: 0o600,
    })
  }

  private async request(
    path = '',
    init?: RequestInit,
    retry = true,
    base = playerUrl,
  ): Promise<Response> {
    await this.refreshIfNeeded()
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, ...init?.headers },
    })
    if (response.status === 429 && retry) {
      const seconds = Number(response.headers.get('retry-after') ?? 1)
      await new Promise((resolve) => setTimeout(resolve, Math.min(5, seconds) * 1000))
      return this.request(path, init, false, base)
    }
    if (!response.ok && response.status !== 204) {
      throw new SpotifyApiError(
        response.status,
        init?.method ?? 'GET',
        path,
        await responseErrorDetails(response),
      )
    }
    return response
  }

  async state(): Promise<PlayerState | null> {
    const response = await this.request()
    if (response.status === 204) return null
    const data = (await response.json()) as SpotifyPlayback
    const item = data.item
    return {
      track: item ? toTrack(item) : null,
      progress: data.progress_ms ?? 0,
      playing: data.is_playing,
      shuffle: data.shuffle_state,
      repeat: data.repeat_state,
      device: data.device.name,
      volume: data.device.volume_percent,
    }
  }

  pause(): Promise<Response> {
    return this.request('/pause', { method: 'PUT' })
  }

  play(): Promise<Response> {
    return this.request('/play', { method: 'PUT' })
  }

  playTrack(track: Track): Promise<Response> {
    return this.request('/play', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [track.uri] }),
    })
  }

  next(): Promise<Response> {
    return this.request('/next', { method: 'POST' })
  }

  previous(): Promise<Response> {
    return this.request('/previous', { method: 'POST' })
  }

  setShuffle(enabled: boolean): Promise<Response> {
    return this.request(`/shuffle?state=${enabled}`, { method: 'PUT' })
  }

  setRepeat(state: PlayerState['repeat']): Promise<Response> {
    return this.request(`/repeat?state=${state}`, { method: 'PUT' })
  }

  setVolume(volume: number): Promise<Response> {
    return this.request(`/volume?volume_percent=${volume}`, { method: 'PUT' })
  }

  seek(position: number): Promise<Response> {
    return this.request(`/seek?position_ms=${Math.round(position)}`, { method: 'PUT' })
  }

  async queue(): Promise<Track[]> {
    const response = await this.request('/queue')
    const data = (await response.json()) as SpotifyQueue
    return data.queue.filter((item) => item.type !== 'episode').map(toTrack)
  }

  async search(query: string): Promise<Track[]> {
    const parameters = new URLSearchParams({ q: query, type: 'track', limit: '20' })
    const response = await this.request(`/search?${parameters}`, undefined, true, apiUrl)
    const data = (await response.json()) as SpotifySearch
    return data.tracks.items.map(toTrack)
  }

  async favorites(): Promise<Track[]> {
    const response = await this.request('/me/tracks?limit=20', undefined, true, apiUrl)
    const data = (await response.json()) as SpotifySavedTracks
    return data.items.map(({ track }) => toTrack(track))
  }
}
