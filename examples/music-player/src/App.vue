<script setup lang="ts">
import {
  Box,
  computed,
  Image,
  Input,
  type MouseEvent,
  nextTick,
  onKeyDown,
  onMounted,
  ProgressBar,
  ref,
  ScrollBox,
  Text,
  useCurrentFocusedElement,
  useExit,
  useInterval,
  useTemplateRef,
  useTerminalSize,
  useTitle,
  watch,
} from 'vue-termui'
import { logError, logPath } from './logging'
import { SpotifyApiError, SpotifyClient, type PlayerState, type Track } from './spotify'

type View = 'main' | 'search' | 'favorites'

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

interface VisibleError {
  title: string
  detail: string
  hint: string
}

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
const view = ref<View>('main')
const queue = ref<Track[]>(client ? [] : demoTracks.slice(1))
const favorites = ref<Track[]>(client ? [] : demoTracks)
const searchResults = ref<Track[]>([])
const searchQuery = ref('')
const selectedIndex = ref(0)
const error = ref<VisibleError | null>(null)
const busy = ref(false)
const controlBusy = ref(false)
const contentBusy = ref(false)
const exit = useExit()
const { width, height } = useTerminalSize()
const progressTrack = useTemplateRef('progressTrack')
const searchInput = useTemplateRef('searchInput')
const trackList = useTemplateRef('trackList')
const focusedElement = useCurrentFocusedElement()
const compact = computed(() => width.value < 88)
const short = computed(() => height.value < 30)
const progressWidth = computed(() =>
  Math.max(16, Math.min(52, width.value - (compact.value ? 12 : 42))),
)
const visibleTracks = computed(() =>
  view.value === 'favorites'
    ? favorites.value
    : view.value === 'search'
      ? searchResults.value
      : queue.value,
)
const contentTitle = computed(() =>
  view.value === 'favorites'
    ? ` Liked songs · ${favorites.value.length} `
    : view.value === 'search'
      ? ` Search results · ${searchResults.value.length} `
      : ` Up next · ${queue.value.length} `,
)
useTitle('Spoterm')

function reportError(action: string, cause: unknown): void {
  logError(action, cause)
  const detail = cause instanceof Error ? cause.message : String(cause)
  let hint = 'Check logs/music-player.log for details.'
  if (cause instanceof SpotifyApiError) {
    if (cause.status === 401) hint = 'Authorization expired. Run the auth command again.'
    else if (cause.status === 403) {
      hint =
        view.value === 'favorites'
          ? 'Favorites need user-library-read. Delete .spotify-token.json and run auth again.'
          : 'Spotify requires Premium, playback permission, and a playable active device.'
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
    if (view.value === 'main') {
      selectedIndex.value = Math.min(selectedIndex.value, Math.max(0, queue.value.length - 1))
    }
  } catch (cause) {
    if (showError) reportError('Load queue', cause)
  }
}

async function loadFavorites(): Promise<void> {
  if (!client || contentBusy.value) return
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
    selectedIndex.value = 0
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

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

async function showView(next: View): Promise<void> {
  view.value = next
  selectedIndex.value = 0
  if (next === 'favorites' && client && favorites.value.length === 0) void loadFavorites()
  if (next === 'search') {
    await nextTick()
    searchInput.value?.$el.focus()
  }
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

function seek(event: MouseEvent): void {
  const element = progressTrack.value?.$el
  const track = state.value.track
  if (!element || !track || element.width <= 0) return
  const ratio = Math.max(0, Math.min(1, (event.x - element.screenX) / element.width))
  const progress = Math.round(track.duration * ratio)
  void control(
    'Seek',
    () => client!.seek(progress),
    () => {
      state.value.progress = progress
    },
  )
}

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
watch(selectedIndex, async (index) => {
  await nextTick()
  trackList.value?.$el.scrollChildIntoView(`track-${view.value}-${index}`)
})

onKeyDown((key) => {
  const typing = focusedElement.value === searchInput.value?.$el
  if (typing) {
    if (key.name === 'escape') void showView('main')
    return
  }
  if (key.name === 'q') exit()
  else if (key.name === '1') void showView('main')
  else if (key.name === '2' || key.name === '/') void showView('search')
  else if (key.name === '3') void showView('favorites')
  else if (key.name === 'space') toggle()
  else if (key.name === 'right' || key.name === 'n') skip(1)
  else if (key.name === 'left' || key.name === 'b') skip(-1)
  else if (key.name === 'up' || key.name === '+') adjustVolume(5)
  else if (key.name === 'down' || key.name === '-') adjustVolume(-5)
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
  else if (key.name === 'j') {
    selectedIndex.value = Math.max(
      0,
      Math.min(visibleTracks.value.length - 1, selectedIndex.value + 1),
    )
  } else if (key.name === 'k') selectedIndex.value = Math.max(0, selectedIndex.value - 1)
  else if (key.name === 'return') {
    const track = visibleTracks.value[selectedIndex.value]
    if (track) playTrack(track)
  }
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
      <Box
        :flexDirection="compact ? 'row' : 'column'"
        :width="compact ? '100%' : 20"
        :height="compact ? 3 : '100%'"
        backgroundColor="#111914"
        :border="true"
        borderStyle="rounded"
        borderColor="#2a3a30"
        :paddingX="1"
        :gap="compact ? 2 : 1"
      >
        <Text v-if="!compact" bold fg="#718077">BROWSE</Text>
        <Box
          :backgroundColor="view === 'main' ? '#23402e' : '#111914'"
          :paddingX="1"
          @mouseDown.left="showView('main')"
          ><Text :bold="view === 'main'" :fg="view === 'main' ? '#1ed760' : '#c4d0c8'"
            >⌂ Main [1]</Text
          ></Box
        >
        <Box
          :backgroundColor="view === 'search' ? '#23402e' : '#111914'"
          :paddingX="1"
          @mouseDown.left="showView('search')"
          ><Text :bold="view === 'search'" :fg="view === 'search' ? '#1ed760' : '#c4d0c8'"
            >⌕ Search [2]</Text
          ></Box
        >
        <Box
          :backgroundColor="view === 'favorites' ? '#23402e' : '#111914'"
          :paddingX="1"
          @mouseDown.left="showView('favorites')"
          ><Text :bold="view === 'favorites'" :fg="view === 'favorites' ? '#1ed760' : '#c4d0c8'"
            >♥ Favorites [3]</Text
          ></Box
        >
        <Box v-if="!compact" :flexGrow="1" />
        <Text v-if="!compact" dim fg="#718077">j/k select · enter play</Text>
      </Box>

      <Box flexDirection="column" :flexGrow="1" :gap="1" overflow="hidden">
        <Box
          v-if="view === 'main'"
          :flexDirection="compact ? 'column' : 'row'"
          :height="short ? 9 : compact ? 15 : 13"
          :border="true"
          borderStyle="rounded"
          borderColor="#1ed760"
          title=" Now playing "
          :padding="1"
          :gap="short ? 0 : 2"
        >
          <Box
            v-if="state.track?.image && !compact && !short"
            :width="22"
            height="100%"
            :flexShrink="0"
            ><Image :source="state.track.image" width="100%" height="100%" fit="cover"
          /></Box>
          <Box flexDirection="column" :flexGrow="1" :gap="short ? 0 : 1">
            <Text bold fg="#ffffff">{{ state.track?.name ?? 'Nothing playing' }}</Text>
            <Text fg="#b7c7bc">{{ state.track?.artist ?? 'Open Spotify on a device' }}</Text>
            <Text v-if="!short" fg="#718077">{{ state.track?.album ?? '' }}</Text>
            <Box
              ref="progressTrack"
              :width="progressWidth"
              @mouseDown.left="seek"
              @mouseDrag="seek"
            >
              <ProgressBar
                :value="state.progress"
                :max="state.track?.duration ?? 1"
                :width="progressWidth"
                color="#1ed760"
                trackColor="#27362d"
              />
            </Box>
            <Text fg="#84978a"
              >{{ formatTime(state.progress) }} / {{ formatTime(state.track?.duration ?? 0) }} ·
              click to seek</Text
            >
            <Box flexDirection="row" :gap="2">
              <Text bold fg="#ffffff">{{ state.playing ? '❚❚ PLAYING' : '▶ PAUSED' }}</Text>
              <Text :fg="state.shuffle ? '#1ed760' : '#59675e'"
                >SHUFFLE {{ state.shuffle ? 'ON' : 'OFF' }}</Text
              >
              <Text fg="#8ca095">REPEAT {{ state.repeat.toUpperCase() }}</Text>
              <Text fg="#b7c7bc">VOL {{ state.volume }}%</Text>
            </Box>
          </Box>
        </Box>

        <Box v-if="view === 'search'" flexDirection="column" :gap="1">
          <Text bold fg="#ffffff">Find your next track</Text>
          <Input
            ref="searchInput"
            v-model="searchQuery"
            width="100%"
            placeholder="Search artists, songs, albums…"
            @enter="runSearch"
          />
          <Text dim fg="#718077">Press Enter to search · Escape returns home</Text>
        </Box>

        <ScrollBox
          ref="trackList"
          flexDirection="column"
          :flexGrow="1"
          :border="true"
          borderStyle="rounded"
          borderColor="#35483b"
          :title="contentTitle"
          :paddingX="1"
          :scrollX="false"
          :scrollY="true"
          overflow="hidden"
        >
          <Text v-if="contentBusy" fg="#1ed760">Loading…</Text>
          <Text v-else-if="visibleTracks.length === 0" fg="#718077">No tracks here yet.</Text>
          <Box
            v-for="(track, index) in visibleTracks"
            v-else
            :key="`${view}-${track.id}-${index}`"
            :id="`track-${view}-${index}`"
            flexDirection="row"
            justifyContent="space-between"
            :backgroundColor="index === selectedIndex ? '#203329' : '#090d0b'"
            :paddingX="1"
            :marginBottom="index === selectedIndex ? 1 : 0"
            @mouseDown.left="((selectedIndex = index), playTrack(track))"
          >
            <Text
              :bold="index === selectedIndex"
              :fg="index === selectedIndex ? '#1ed760' : '#e2e8e4'"
              >{{ index === selectedIndex ? '▶' : `${index + 1}.` }} {{ track.name }} ·
              {{ track.artist }}</Text
            >
            <Text v-if="!compact" fg="#718077"
              >{{ track.album }} · {{ formatTime(track.duration) }}</Text
            >
          </Box>
        </ScrollBox>

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
      <Text fg="#d9e5dc">space play · ←/→ track · ↑/↓ volume · s shuffle · r repeat</Text>
      <Text fg="#718077">q quit</Text>
    </Box>
  </Box>
</template>
