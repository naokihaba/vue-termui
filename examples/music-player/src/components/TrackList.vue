<script setup lang="ts">
import { Box, Image, nextTick, ref, ScrollBox, Text, useTemplateRef, watch } from 'vue-termui'
import type { Track } from '../spotify'

const props = defineProps<{
  tracks: Track[]
  title: string
  busy?: boolean
  compact?: boolean
  autofocus?: boolean
  idPrefix: string
}>()

const emit = defineEmits<{ play: [track: Track] }>()
const selected = ref(0)
const focused = ref(false)
const list = useTemplateRef('list')
const placeholderArtwork = new URL('../assets/album-placeholder.webp', import.meta.url)

function select(index: number): void {
  if (!props.tracks.length) return
  selected.value = Math.max(0, Math.min(props.tracks.length - 1, index))
}

function move(step: number): void {
  select(selected.value + step)
}

function play(index = selected.value): void {
  const track = props.tracks[index]
  if (track) emit('play', track)
}

function focus(): void {
  list.value?.$el.focus()
}

watch(
  () => props.tracks,
  () => select(selected.value),
)
watch(selected, async (index) => {
  await nextTick()
  list.value?.$el.scrollChildIntoView(`${props.idPrefix}-${index}`)
})

defineExpose({ focus })
</script>

<template>
  <ScrollBox
    ref="list"
    :id="`${idPrefix}-list`"
    flexDirection="column"
    :flexGrow="1"
    :border="true"
    borderStyle="rounded"
    :borderColor="focused ? '#1ed760' : '#35483b'"
    :title="title"
    :paddingX="1"
    :scrollX="false"
    :scrollY="true"
    overflow="hidden"
    :autofocus="autofocus"
    @focus="focused = true"
    @blur="focused = false"
    @keyDown.down.stop.prevent="move(1)"
    @keyDown.j.stop.prevent="move(1)"
    @keyDown.up.stop.prevent="move(-1)"
    @keyDown.k.stop.prevent="move(-1)"
    @keyDown.home.stop.prevent="select(0)"
    @keyDown.end.stop.prevent="select(tracks.length - 1)"
    @keyDown.enter.stop.prevent="play()"
  >
    <Text v-if="busy" fg="#1ed760">Loading…</Text>
    <Text v-else-if="tracks.length === 0" fg="#718077">No tracks here yet.</Text>
    <Box
      v-for="(track, index) in tracks"
      v-else
      :key="`${track.id}-${index}`"
      :id="`${idPrefix}-${index}`"
      width="100%"
      flexDirection="row"
      alignItems="center"
      :gap="1"
      :height="5"
      :flexShrink="0"
      :backgroundColor="index === selected ? '#203329' : '#090d0b'"
      :paddingX="1"
      @mouseDown.left="((selected = index), play(index), focus())"
    >
      <Image
        :source="track.image ?? placeholderArtwork"
        :width="8"
        :height="4"
        fit="cover"
        :flexShrink="0"
      />
      <Box flexDirection="column" :flexGrow="1" justifyContent="center">
        <Text :bold="index === selected" :fg="index === selected ? '#1ed760' : '#e2e8e4'">
          {{ index === selected ? '▶' : `${index + 1}.` }} {{ track.name }} · {{ track.artist }}
        </Text>
        <Text v-if="!compact" fg="#718077">
          {{ track.album }} · {{ Math.floor(track.duration / 60000) }}:{{
            String(Math.floor(track.duration / 1000) % 60).padStart(2, '0')
          }}
        </Text>
      </Box>
    </Box>
  </ScrollBox>
</template>
