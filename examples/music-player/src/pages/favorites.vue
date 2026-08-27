<script setup lang="ts">
import { onMounted } from 'vue-termui'
import TrackList from '../components/TrackList.vue'
import { usePlayer } from '../player'

const player = usePlayer()

onMounted(() => void player.loadFavorites())
</script>

<template>
  <TrackList
    :tracks="player.favorites.value"
    :title="` Liked songs · ${player.favorites.value.length} `"
    idPrefix="favorite-track"
    :busy="player.contentBusy.value"
    :compact="player.compact.value"
    autofocus
    @play="player.playTrack"
  />
</template>
