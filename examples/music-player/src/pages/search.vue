<script setup lang="ts">
import { Box, Input, nextTick, Text, useTemplateRef } from 'vue-termui'
import TrackList from '../components/TrackList.vue'
import { usePlayer } from '../player'

const player = usePlayer()

const results = useTemplateRef('results')

async function search(): Promise<void> {
  await player.runSearch()
  await nextTick()
  results.value?.focus()
}
</script>

<template>
  <Box flexDirection="column" :flexGrow="1" :gap="1" overflow="hidden">
    <Box flexDirection="column" :gap="1" :flexShrink="0">
      <Text bold fg="#ffffff">Find your next track</Text>
      <Input
        id="search-input"
        v-model="player.searchQuery.value"
        width="100%"
        placeholder="Search artists, songs, albums…"
        autofocus
        @enter="search"
      />
      <Text dim fg="#718077">Enter searches · Tab moves to results · Escape returns home</Text>
    </Box>
    <TrackList
      ref="results"
      :tracks="player.searchResults.value"
      :title="` Search results · ${player.searchResults.value.length} `"
      idPrefix="search-track"
      :busy="player.contentBusy.value"
      :compact="player.compact.value"
      @play="player.playTrack"
    />
  </Box>
</template>
