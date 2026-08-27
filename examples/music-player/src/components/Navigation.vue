<script setup lang="ts">
import { Box, computed, shallowRef, Text, useCurrentFocusedElement } from 'vue-termui'
import { useRoute, useRouter } from 'vue-router'

defineProps<{ compact: boolean }>()

const items = [
  { label: '⌂ Main', shortcut: '1', to: '/' },
  { label: '⌕ Search', shortcut: '2', to: '/search' },
  { label: '♥ Favorites', shortcut: '3', to: '/favorites' },
] as const

const route = useRoute()
const router = useRouter()
const focusedElement = useCurrentFocusedElement()
const elements = shallowRef<Array<{ focus: () => void } | undefined>>([])
const activeIndex = computed(() =>
  Math.max(
    0,
    items.findIndex(({ to }) => to === route.path),
  ),
)

function setRef(index: number, instance: any): void {
  elements.value[index] = instance?.$el ?? instance ?? undefined
}

function focusAt(index: number): void {
  const normalized = (index + items.length) % items.length
  elements.value[normalized]?.focus()
}

function focusedIndex(): number {
  return elements.value.findIndex((element) => element === focusedElement.value)
}

function move(step: number): void {
  const current = focusedIndex()
  focusAt((current < 0 ? activeIndex.value : current) + step)
}

function open(index: number): void {
  void router.push(items[index]!.to)
}

function focusActive(): void {
  focusAt(activeIndex.value)
}

defineExpose({ focusActive })
</script>

<template>
  <Box
    :flexDirection="compact ? 'row' : 'column'"
    :width="compact ? '100%' : 20"
    :height="compact ? 3 : '100%'"
    backgroundColor="#111914"
    :border="true"
    borderStyle="rounded"
    borderColor="#2a3a30"
    focusedBorderColor="#1ed760"
    :paddingX="1"
    :gap="compact ? 2 : 1"
  >
    <Text v-if="!compact" bold fg="#718077">BROWSE</Text>
    <Box
      v-for="(item, index) in items"
      :key="item.to"
      :ref="(instance) => setRef(index, instance)"
      focusable
      :backgroundColor="
        focusedElement === elements[index]
          ? '#1ed760'
          : route.path === item.to
            ? '#23402e'
            : '#111914'
      "
      :paddingX="1"
      @keyDown.down.stop.prevent="move(1)"
      @keyDown.right.stop.prevent="move(1)"
      @keyDown.up.stop.prevent="move(-1)"
      @keyDown.left.stop.prevent="move(-1)"
      @keyDown.enter.stop.prevent="open(index)"
      @mouseDown.left="open(index)"
    >
      <Text
        :bold="route.path === item.to || focusedElement === elements[index]"
        :fg="
          focusedElement === elements[index]
            ? '#090d0b'
            : route.path === item.to
              ? '#1ed760'
              : '#c4d0c8'
        "
        >{{ item.label }} [{{ item.shortcut }}]</Text
      >
    </Box>
    <Box v-if="!compact" :flexGrow="1" />
    <Text v-if="!compact" dim fg="#718077">arrows navigate · enter open</Text>
  </Box>
</template>
