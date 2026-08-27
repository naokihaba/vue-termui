<script setup lang="ts">
import { Box, Image, type MouseEvent, ProgressBar, Text, useTemplateRef } from 'vue-termui'
import TrackList from '../components/TrackList.vue'
import { usePlayer } from '../player'

const player = usePlayer()

const progressTrack = useTemplateRef('progressTrack')
const placeholderArtwork = new URL('../assets/album-placeholder.webp', import.meta.url)

function seek(event: MouseEvent): void {
  const element = progressTrack.value?.$el
  const track = player.state.value.track
  if (!element || !track || element.width <= 0) return
  const ratio = Math.max(0, Math.min(1, (event.x - element.screenX) / element.width))
  player.seekTo(Math.round(track.duration * ratio))
}
</script>

<template>
  <Box flexDirection="column" :flexGrow="1" :gap="1" overflow="hidden">
    <Box
      flexDirection="row"
      :height="player.short.value ? 9 : player.compact.value ? 15 : 13"
      :border="true"
      borderStyle="rounded"
      borderColor="#1ed760"
      title=" Now playing "
      :padding="1"
      :gap="player.short.value ? 0 : 2"
    >
      <Box
        :width="player.short.value ? 10 : player.compact.value ? 14 : 22"
        height="100%"
        :flexShrink="0"
      >
        <Image
          :source="player.state.value.track?.image ?? placeholderArtwork"
          width="100%"
          height="100%"
          fit="cover"
        />
      </Box>
      <Box flexDirection="column" :flexGrow="1" :gap="player.short.value ? 0 : 1">
        <Text bold fg="#ffffff">{{ player.state.value.track?.name ?? 'Nothing playing' }}</Text>
        <Text fg="#b7c7bc">{{
          player.state.value.track?.artist ?? 'Open Spotify on a device'
        }}</Text>
        <Text v-if="!player.short.value" fg="#718077">{{
          player.state.value.track?.album ?? ''
        }}</Text>
        <Box
          ref="progressTrack"
          :width="player.progressWidth.value"
          @mouseDown.left="seek"
          @mouseDrag="seek"
        >
          <ProgressBar
            :value="player.state.value.progress"
            :max="player.state.value.track?.duration ?? 1"
            :width="player.progressWidth.value"
            color="#1ed760"
            trackColor="#27362d"
          />
        </Box>
        <Text fg="#84978a">
          {{ player.formatTime(player.state.value.progress) }} /
          {{ player.formatTime(player.state.value.track?.duration ?? 0) }} · click to seek
        </Text>
        <Box flexDirection="row" :gap="2">
          <Text bold fg="#ffffff">{{
            player.state.value.playing ? '❚❚ PLAYING' : '▶ PAUSED'
          }}</Text>
          <Text :fg="player.state.value.shuffle ? '#1ed760' : '#59675e'">
            SHUFFLE {{ player.state.value.shuffle ? 'ON' : 'OFF' }}
          </Text>
          <Text fg="#8ca095">REPEAT {{ player.state.value.repeat.toUpperCase() }}</Text>
          <Text fg="#b7c7bc">VOL {{ player.state.value.volume }}%</Text>
        </Box>
      </Box>
    </Box>

    <TrackList
      :tracks="player.queue.value"
      :title="` Up next · ${player.queue.value.length} `"
      idPrefix="queue-track"
      :compact="player.compact.value"
      autofocus
      @play="player.playTrack"
    />
  </Box>
</template>
