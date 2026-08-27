<script setup lang="ts">
import {
  Box,
  computed,
  Image,
  onKeyDown,
  onMounted,
  ref,
  Text,
  useExit,
  useTerminalSize,
  useTitle,
} from 'vue-termui'
import { dirname, extname, resolve } from 'node:path'
import { formatSize, imageExtensions, listDirectory, preview, relativePath, type Entry } from './fs'

const root = resolve(process.cwd())
const currentPath = ref(root)
const entries = ref<Entry[]>([])
const selected = ref(0)
const previewLines = ref<string[]>([])
const hidden = ref(false)
const error = ref('')
const loading = ref(false)
const exit = useExit()
const { width } = useTerminalSize()
useTitle(() => `Vue Ranger — ${relativePath(root, currentPath.value)}`)

const selectedEntry = computed(() => entries.value[selected.value])
const imagePreview = computed(() => {
  const entry = selectedEntry.value
  return entry && !entry.directory && imageExtensions.has(extname(entry.name).toLowerCase())
    ? entry.path
    : null
})

async function load(): Promise<void> {
  loading.value = true
  try {
    entries.value = await listDirectory(root, currentPath.value, hidden.value)
    selected.value = Math.min(selected.value, Math.max(0, entries.value.length - 1))
    error.value = ''
    await loadPreview()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

async function loadPreview(): Promise<void> {
  const entry = selectedEntry.value
  previewLines.value = entry ? await preview(entry) : ['Empty directory']
}

async function move(step: number): Promise<void> {
  if (!entries.value.length) return
  selected.value = (selected.value + step + entries.value.length) % entries.value.length
  await loadPreview()
}

async function open(): Promise<void> {
  const entry = selectedEntry.value
  if (!entry?.directory) return
  currentPath.value = entry.path
  selected.value = 0
  await load()
}

async function up(): Promise<void> {
  if (currentPath.value === root) return
  currentPath.value = dirname(currentPath.value)
  selected.value = 0
  await load()
}

function entryLabel(entry: Entry): string {
  const icon = entry.symlink
    ? '@'
    : entry.directory
      ? '▸'
      : imageExtensions.has(extname(entry.name).toLowerCase())
        ? '▧'
        : '·'
  return `${icon} ${entry.name}`
}

onMounted(load)
onKeyDown((key) => {
  if (key.name === 'q') exit()
  else if (key.name === 'up' || key.name === 'k') void move(-1)
  else if (key.name === 'down' || key.name === 'j') void move(1)
  else if (key.name === 'return' || key.name === 'right' || key.name === 'l') void open()
  else if (key.name === 'backspace' || key.name === 'left') void up()
  else if (key.name === 'h') {
    hidden.value = !hidden.value
    void load()
  } else if (key.name === 'r') void load()
})
</script>

<template>
  <Box flexDirection="column" :flexGrow="1" backgroundColor="#101419">
    <Box flexDirection="row" justifyContent="space-between" backgroundColor="#202830" :paddingX="1">
      <Text bold fg="#61afef">VUE RANGER</Text>
      <Text fg="#d7dee7">~/{{ relativePath(root, currentPath) }}</Text>
      <Text :fg="hidden ? '#e5c07b' : '#7f8a96'">{{
        hidden ? 'hidden shown' : `${entries.length} items`
      }}</Text>
    </Box>

    <Box flexDirection="row" :flexGrow="1" :padding="1" :gap="1" overflow="hidden">
      <Box
        flexDirection="column"
        :width="width < 90 ? '44%' : '38%'"
        :border="true"
        borderStyle="rounded"
        borderColor="#61afef"
        title=" Files "
        :paddingX="1"
        overflow="hidden"
      >
        <Text v-if="loading" fg="#7f8a96">Loading…</Text>
        <Text
          v-for="(entry, index) in entries"
          :key="entry.path"
          :fg="entry.directory ? '#61afef' : index === selected ? '#ffffff' : '#b6bec8'"
          :bg="index === selected ? '#2b3942' : undefined"
          :bold="index === selected"
          >{{ index === selected ? '›' : ' ' }} {{ entryLabel(entry) }}</Text
        >
      </Box>

      <Box
        flexDirection="column"
        :flexGrow="1"
        :border="true"
        borderStyle="rounded"
        borderColor="#46505a"
        :title="` Preview · ${selectedEntry?.name ?? '—'} `"
        :padding="1"
        overflow="hidden"
      >
        <Image v-if="imagePreview" :source="imagePreview" width="100%" height="80%" fit="fit" />
        <Text v-for="(line, index) in previewLines" v-else :key="index" fg="#c9d1d9"
          >{{ String(index + 1).padStart(3) }} {{ line }}</Text
        >
        <Text v-if="selectedEntry" fg="#7f8a96"
          >{{ selectedEntry.directory ? 'directory' : formatSize(selectedEntry.size) }} ·
          {{ selectedEntry.modified.toLocaleString() }}</Text
        >
        <Text v-if="error" fg="#e06c75">{{ error }}</Text>
      </Box>
    </Box>

    <Box flexDirection="row" justifyContent="space-between" backgroundColor="#202830" :paddingX="1">
      <Text fg="#d6dde5"
        >↑↓/jk select · enter/l open · ←/backspace parent · h hidden · r refresh</Text
      >
      <Text fg="#7f8a96">read only · q quit</Text>
    </Box>
  </Box>
</template>
