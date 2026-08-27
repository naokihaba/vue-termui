<script setup lang="ts">
import {
  Box,
  computed,
  nextTick,
  onKeyDown,
  onMounted,
  provide,
  ref,
  Text,
  useCurrentFocusedElement,
  useExit,
  useFocusManager,
  useInterval,
  useTemplateRef,
  useTerminalSize,
  useTitle,
} from 'vue-termui'
import { RouterView, useRouter } from 'vue-router'
import Navigation from './components/Navigation.vue'
import { logError, logPath } from './logging'
import { playerKey, type PlayerContext, type VisibleError } from './player'
import { SpotifyApiError, SpotifyClient, type PlayerState, type Track } from './spotify'

const demoTracks: Track[] = [
  {
    id: '1',
    uri: 'spotify:track:demo-1',
    name: 'Midnight Compiler',
    artist: 'The Reactives',
    album: 'Hot Module Reload',
    duration: 234_000,
  },
  {
    id: '2',
    uri: 'spotify:track:demo-2',
    name: 'Signals in the Rain',
    artist: 'Computed Dreams',
    album: 'Dependency Graph',
    duration: 198_000,
  },
  {
    id: '3',
    uri: 'spotify:track:demo-3',
    name: 'Terminal Velocity',
    artist: 'Open TUI',
    album: 'Cell by Cell',
    duration: 267_000,
  },
  {
    id: '4',
    uri: 'spotify:track:demo-4',
    name: 'One Runtime',
    artist: 'Vue Ensemble',
    album: 'Provide / Inject',
    duration: 221_000,
  },
]

const client = SpotifyClient.create()
const demoIndex = ref(0)
const state = ref<PlayerState>({
  track: demoTracks[0]!,
  progress: 74_000,
  playing: true,
  shuffle: false,
  repeat: 'off',
  device: client ? 'Connecting…' : 'Demo device',
  volume: 72,
})
const queue = ref<Track[]>(client ? [] : demoTracks.slice(1))
const favorites = ref<Track[]>(client ? [] : demoTracks)
const searchResults = ref<Track[]>([])
const searchQuery = ref('')
const error = ref<VisibleError | null>(null)
const busy = ref(false)
const controlBusy = ref(false)
const contentBusy = ref(false)
const exit = useExit()
const router = useRouter()
const focusedElement = useCurrentFocusedElement()
const navigation = useTemplateRef('navigation')
const { focusNext, focusPrevious } = useFocusManager()
const { width, height } = useTerminalSize()
const compact = computed(() => width.value < 88)
const short = computed(() => height.value < 30)
const progressWidth = computed(() =>
  Math.max(12, Math.min(52, width.value - (compact.value ? 34 : 50))),
)

useTitle('Spoterm')

function reportError(action: string, cause: unknown): void {
  logError(action, cause)
  const detail = cause instanceof Error ? cause.message : String(cause)
  let hint = 'Check logs/music-player.log for details.'
  if (cause instanceof SpotifyApiError) {
    if (cause.status === 401) hint = 'Authorization expired. Run the auth command again.'
    else if (cause.status === 403) {
      hint = 'Spotify requires the requested permission, Premium playback, and a playable device.'
    } else if (cause.status === 404) hint = 'Open Spotify on a device, start a track, then retry.'
    else if (cause.status === 429) hint = 'Spotify rate-limited the app. Wait a moment and retry.'
  }
  error.value = { title: `${action} failed`, detail, hint }
}

async function refresh(showError = true): Promise<void> {
  if (!client || busy.value) return
  busy.value = true
  try {
    const current = await client.state()
    if (current) state.value = current
    else if (showError) {
      error.value = {
        title: 'No active Spotify device',
        detail: 'Spotify returned no playback state.',
        hint: 'Open Spotify on a device and start a track.',
      }
    }
  } catch (cause) {
    if (showError) reportError('Refresh', cause)
  } finally {
    busy.value = false
  }
}

async function refreshQueue(showError = true): Promise<void> {
  if (!client) return
  try {
    queue.value = await client.queue()
  } catch (cause) {
    if (showError) reportError('Load queue', cause)
  }
}

async function loadFavorites(): Promise<void> {
  if (!client || contentBusy.value || favorites.value.length > 0) return
  contentBusy.value = true
  try {
    favorites.value = await client.favorites()
    error.value = null
  } catch (cause) {
    reportError('Load favorites', cause)
  } finally {
    contentBusy.value = false
  }
}

async function runSearch(): Promise<void> {
  const query = searchQuery.value.trim()
  if (!client || !query || contentBusy.value) return
  contentBusy.value = true
  try {
    searchResults.value = await client.search(query)
    error.value = null
  } catch (cause) {
    reportError('Search', cause)
  } finally {
    contentBusy.value = false
  }
}

async function control(
  label: string,
  action: () => Promise<unknown>,
  optimistic: () => void,
): Promise<void> {
  if (controlBusy.value) return
  if (!client) {
    optimistic()
    error.value = null
    return
  }
  controlBusy.value = true
  const previous = { ...state.value }
  optimistic()
  try {
    await action()
    await refresh(false)
    error.value = null
  } catch (cause) {
    state.value = previous
    reportError(label, cause)
  } finally {
    controlBusy.value = false
  }
}

function changeDemoTrack(track: Track): void {
  demoIndex.value = demoTracks.findIndex(({ id }) => id === track.id)
  state.value.track = track
  state.value.progress = 0
  state.value.playing = true
}

function playTrack(track: Track): void {
  void control(
    `Play ${track.name}`,
    () => client!.playTrack(track),
    () => {
      if (!client) changeDemoTrack(track)
      else {
        state.value.track = track
        state.value.progress = 0
        state.value.playing = true
      }
    },
  )
}

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function toggle(): void {
  const wasPlaying = state.value.playing
  void control(
    wasPlaying ? 'Pause' : 'Play',
    () => (wasPlaying ? client!.pause() : client!.play()),
    () => {
      state.value.playing = !wasPlaying
    },
  )
}

function skip(step: number): void {
  void control(
    step > 0 ? 'Next track' : 'Previous track',
    () => (step > 0 ? client!.next() : client!.previous()),
    () => {
      if (!client) {
        changeDemoTrack(
          demoTracks[(demoIndex.value + step + demoTracks.length) % demoTracks.length]!,
        )
      }
    },
  ).then(() => void refreshQueue(false))
}

function adjustVolume(step: number): void {
  const volume = Math.max(0, Math.min(100, state.value.volume + step))
  void control(
    'Change volume',
    () => client!.setVolume(volume),
    () => {
      state.value.volume = volume
    },
  )
}

function cycleRepeat(): void {
  const modes: PlayerState['repeat'][] = ['off', 'context', 'track']
  const next = modes[(modes.indexOf(state.value.repeat) + 1) % modes.length]!
  void control(
    'Change repeat mode',
    () => client!.setRepeat(next),
    () => {
      state.value.repeat = next
    },
  )
}

function seekTo(progress: number): void {
  void control(
    'Seek',
    () => client!.seek(progress),
    () => {
      state.value.progress = progress
    },
  )
}

function navigate(path: '/' | '/search' | '/favorites'): void {
  void router.push(path)
}

provide<PlayerContext>(playerKey, {
  connected: !!client,
  state,
  queue,
  favorites,
  searchResults,
  searchQuery,
  error,
  contentBusy,
  compact,
  short,
  progressWidth,
  formatTime,
  loadFavorites,
  playTrack,
  runSearch,
  seekTo,
})

onMounted(() => {
  void refresh()
  void refreshQueue()
})
useInterval(() => {
  if (!client && state.value.playing && state.value.track) {
    state.value.progress = (state.value.progress + 1000) % state.value.track.duration
  } else void refresh(false)
}, 1000)
useInterval(() => void refreshQueue(false), 15_000)

onKeyDown((key) => {
  if (key.name === 'tab') {
    key.preventDefault()
    if (key.shift) focusPrevious()
    else focusNext()
    return
  }

  const typing = focusedElement.value?.id === 'search-input'
  if (key.name === 'escape') {
    key.preventDefault()
    if (router.currentRoute.value.path !== '/') {
      void router.push('/').then(async () => {
        await nextTick()
        navigation.value?.focusActive()
      })
    } else navigation.value?.focusActive()
    return
  }
  if (typing) return

  if (key.name === 'q') exit()
  else if (key.name === '1') navigate('/')
  else if (key.name === '2' || key.name === '/') navigate('/search')
  else if (key.name === '3') navigate('/favorites')
  else if (key.name === 'space') toggle()
  else if (key.name === 'n' || key.name === ']') skip(1)
  else if (key.name === 'b' || key.name === '[') skip(-1)
  else if (key.name === '+' || key.name === '=') adjustVolume(5)
  else if (key.name === '-') adjustVolume(-5)
  else if (key.name === 's') {
    const shuffle = !state.value.shuffle
    void control(
      'Change shuffle mode',
      () => client!.setShuffle(shuffle),
      () => {
        state.value.shuffle = shuffle
      },
    )
  } else if (key.name === 'r') cycleRepeat()
})
</script>

<template>
  <Box flexDirection="column" :flexGrow="1" backgroundColor="#090d0b">
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      backgroundColor="#15221b"
      :paddingX="2"
      :height="3"
      :flexShrink="0"
    >
      <Text bold fg="#1ed760">● SPOTERM</Text>
      <Text v-if="!compact" fg="#9eafa4">{{ client ? 'Spotify Connect' : 'Demo mode' }}</Text>
      <Text fg="#dce8e0">{{ state.device }}</Text>
    </Box>

    <Box
      :flexDirection="compact ? 'column' : 'row'"
      :flexGrow="1"
      :padding="1"
      :gap="1"
      overflow="hidden"
    >
      <Navigation ref="navigation" :compact="compact" />
      <Box flexDirection="column" :flexGrow="1" :gap="1" overflow="hidden">
        <RouterView />
        <Box
          v-if="error"
          flexDirection="column"
          :border="true"
          borderStyle="rounded"
          borderColor="#e06c75"
          title=" Error "
          :paddingX="1"
        >
          <Text bold fg="#e06c75">{{ error.title }}</Text>
          <Text fg="#f2b8b5" wrapMode="word">{{ error.detail }}</Text>
          <Text fg="#d6a4a1" wrapMode="word">{{ error.hint }}</Text>
          <Text v-if="!short" dim fg="#8ca095" wrapMode="word">Log: {{ logPath }}</Text>
        </Box>
      </Box>
    </Box>

    <Box
      flexDirection="row"
      justifyContent="space-between"
      backgroundColor="#15221b"
      :paddingX="2"
      :height="1"
      :flexShrink="0"
    >
      <Text fg="#d9e5dc"
        >tab focus · space play · b/n track · +/- volume · s shuffle · r repeat</Text
      >
      <Text fg="#718077">esc home · q quit</Text>
    </Box>
  </Box>
</template>
