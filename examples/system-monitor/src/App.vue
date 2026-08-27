<script setup lang="ts">
import {
  Box,
  computed,
  onKeyDown,
  onMounted,
  ProgressBar,
  ref,
  Text,
  useExit,
  useInterval,
  useTerminalSize,
  useTitle,
} from 'vue-termui'
import { readMetrics, type Metrics, type ProcessInfo } from './metrics'

type SortKey = 'cpu' | 'memory'

const accent = '#61afef'
const green = '#42b883'
const yellow = '#e5c07b'
const muted = '#7f8a96'

const metrics = ref<Metrics>({
  cpu: 0,
  memory: 0,
  usedMemory: 0,
  totalMemory: 1,
  load: [0, 0, 0],
  uptime: 0,
  processes: [],
})
const cpuHistory = ref<number[]>(Array.from({ length: 40 }, () => 0))
const memoryHistory = ref<number[]>(Array.from({ length: 40 }, () => 0))
const selected = ref(0)
const sortKey = ref<SortKey>('cpu')
const paused = ref(false)
const busy = ref(false)
const lastUpdated = ref('starting…')

const exit = useExit()
const { width } = useTerminalSize()
useTitle('Pulse system monitor')

const compact = computed(() => width.value < 90)
const gaugeWidth = computed(() => Math.max(12, Math.min(38, Math.floor(width.value / 2) - 8)))
const sortedProcesses = computed(() =>
  [...metrics.value.processes].sort((a, b) => b[sortKey.value] - a[sortKey.value]),
)
const selectedProcess = computed(() => sortedProcesses.value[selected.value])

async function refresh(): Promise<void> {
  if (paused.value || busy.value) return
  busy.value = true
  try {
    metrics.value = await readMetrics()
    cpuHistory.value = [...cpuHistory.value.slice(1), metrics.value.cpu]
    memoryHistory.value = [...memoryHistory.value.slice(1), metrics.value.memory]
    selected.value = Math.min(selected.value, Math.max(0, metrics.value.processes.length - 1))
    lastUpdated.value = new Date().toLocaleTimeString()
  } finally {
    busy.value = false
  }
}

function move(step: number): void {
  const count = sortedProcesses.value.length
  if (count) selected.value = (selected.value + step + count) % count
}

function formatBytes(value: number): string {
  return `${(value / 1024 ** 3).toFixed(1)} GB`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

function sparkline(values: number[]): string {
  const chars = '▁▂▃▄▅▆▇█'
  return values
    .map((value) => chars[Math.min(chars.length - 1, Math.floor((value / 100) * chars.length))])
    .join('')
}

function processLabel(process: ProcessInfo): string {
  const command = process.command.split('/').at(-1) ?? process.command
  return `${String(process.pid).padStart(6)}  ${process.cpu.toFixed(1).padStart(5)}  ${process.memory.toFixed(1).padStart(5)}  ${process.user.padEnd(10).slice(0, 10)}  ${command}`
}

onMounted(refresh)
useInterval(refresh, 1500)

onKeyDown((key) => {
  if (key.name === 'q') exit()
  else if (key.name === 'up' || key.name === 'k') move(-1)
  else if (key.name === 'down' || key.name === 'j') move(1)
  else if (key.name === 'c') sortKey.value = 'cpu'
  else if (key.name === 'm') sortKey.value = 'memory'
  else if (key.name === 'p' || key.name === 'space') paused.value = !paused.value
  else if (key.name === 'r') void refresh()
})
</script>

<template>
  <Box flexDirection="column" :flexGrow="1" backgroundColor="#101419">
    <Box
      flexDirection="row"
      justifyContent="space-between"
      backgroundColor="#202830"
      :paddingX="1"
      :flexShrink="0"
    >
      <Text bold :fg="accent">PULSE</Text>
      <Text fg="#c9d1d9">{{ compact ? 'system monitor' : 'vue-termui system monitor' }}</Text>
      <Text :fg="paused ? yellow : green">{{ paused ? 'PAUSED' : `LIVE · ${lastUpdated}` }}</Text>
    </Box>

    <Box flexDirection="column" :flexGrow="1" :padding="1" :gap="1" overflow="hidden">
      <Box flexDirection="row" :gap="1" :height="compact ? 11 : 9">
        <Box
          flexDirection="column"
          :width="'50%'"
          :border="true"
          borderStyle="rounded"
          :borderColor="accent"
          title=" CPU "
          :paddingX="1"
        >
          <Text bold :fg="metrics.cpu > 80 ? '#e06c75' : accent"
            >{{ metrics.cpu.toFixed(1) }}%</Text
          >
          <ProgressBar
            :value="metrics.cpu"
            :max="100"
            :width="gaugeWidth"
            :color="accent"
            trackColor="#28313a"
          />
          <Text :fg="muted">{{ sparkline(cpuHistory) }}</Text>
          <Text v-if="!compact" fg="#b6bec8"
            >Load {{ metrics.load.map((n) => n.toFixed(2)).join('  ') }}</Text
          >
        </Box>

        <Box
          flexDirection="column"
          :flexGrow="1"
          :border="true"
          borderStyle="rounded"
          :borderColor="green"
          title=" Memory "
          :paddingX="1"
        >
          <Text bold :fg="green">{{ metrics.memory.toFixed(1) }}%</Text>
          <ProgressBar
            :value="metrics.memory"
            :max="100"
            :width="gaugeWidth"
            :color="green"
            trackColor="#28313a"
          />
          <Text :fg="muted">{{ sparkline(memoryHistory) }}</Text>
          <Text v-if="!compact" fg="#b6bec8"
            >{{ formatBytes(metrics.usedMemory) }} / {{ formatBytes(metrics.totalMemory) }}</Text
          >
        </Box>
      </Box>

      <Box
        flexDirection="column"
        :flexGrow="1"
        :border="true"
        borderStyle="rounded"
        borderColor="#46505a"
        :title="` Processes · sorted by ${sortKey.toUpperCase()} `"
        :paddingX="1"
        overflow="hidden"
      >
        <Text :fg="muted"> PID CPU% MEM% USER COMMAND</Text>
        <Text
          v-for="(process, index) in sortedProcesses"
          :key="process.pid"
          :fg="index === selected ? '#ffffff' : '#b6bec8'"
          :bg="index === selected ? '#2b3942' : undefined"
          :bold="index === selected"
          >{{ index === selected ? '›' : ' ' }}{{ processLabel(process) }}</Text
        >
      </Box>

      <Box v-if="!compact" flexDirection="row" justifyContent="space-between" :height="1">
        <Text :fg="muted">Uptime {{ formatUptime(metrics.uptime) }}</Text>
        <Text :fg="selectedProcess ? accent : muted">{{
          selectedProcess
            ? `PID ${selectedProcess.pid} · ${selectedProcess.command}`
            : 'Waiting for process data'
        }}</Text>
      </Box>
    </Box>

    <Box flexDirection="row" justifyContent="space-between" backgroundColor="#202830" :paddingX="1">
      <Text fg="#d6dde5">↑↓/jk select · c CPU · m memory · p pause · r refresh</Text>
      <Text :fg="muted">q quit</Text>
    </Box>
  </Box>
</template>
