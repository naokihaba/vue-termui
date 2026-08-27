import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue-termui'
import type { PlayerState, Track } from './spotify'

export interface VisibleError {
  title: string
  detail: string
  hint: string
}

export interface PlayerContext {
  connected: boolean
  state: Ref<PlayerState>
  queue: Ref<Track[]>
  favorites: Ref<Track[]>
  searchResults: Ref<Track[]>
  searchQuery: Ref<string>
  error: Ref<VisibleError | null>
  contentBusy: Ref<boolean>
  compact: ComputedRef<boolean>
  short: ComputedRef<boolean>
  progressWidth: ComputedRef<number>
  formatTime: (milliseconds: number) => string
  loadFavorites: () => Promise<void>
  playTrack: (track: Track) => void
  runSearch: () => Promise<void>
  seekTo: (progress: number) => void
}

export const playerKey: InjectionKey<PlayerContext> = Symbol('music-player')

export function usePlayer(): PlayerContext {
  const player = inject(playerKey)
  if (!player) throw new Error('Music player context is unavailable')
  return player
}
