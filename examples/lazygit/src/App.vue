<script setup lang="ts">
import {
  Box,
  computed,
  Input,
  onKeyDown,
  ref,
  Text,
  useExit,
  useTerminalSize,
  useTitle,
} from 'vue-termui'
import Panel from './components/Panel.vue'

type FileState = 'modified' | 'added' | 'deleted'

interface ChangedFile {
  path: string
  state: FileState
  staged: boolean
}

interface Branch {
  name: string
  ahead: number
  behind: number
}

interface Commit {
  hash: string
  message: string
  author: string
  age: string
  pushed: boolean
}

const green = '#42b883'
const muted = '#7f8a96'
const yellow = '#e5c07b'
const red = '#e06c75'
const blue = '#61afef'

const panels = ['Files', 'Branches', 'Commits', 'Command log'] as const
const activePanel = ref(0)
const selectedFile = ref(0)
const selectedBranch = ref(0)
const selectedCommit = ref(0)
const selectedLog = ref(0)
const helpVisible = ref(false)
const commitVisible = ref(false)
const commitMessage = ref('')
const currentBranch = ref('feat/examples')

const files = ref<ChangedFile[]>([
  { path: 'AGENTS.md', state: 'modified', staged: true },
  { path: 'pnpm-workspace.yaml', state: 'modified', staged: true },
  { path: 'examples/lazygit/src/App.vue', state: 'added', staged: false },
  { path: 'examples/lazygit/src/components/Panel.vue', state: 'added', staged: false },
  { path: 'old/src/legacy-renderer.ts', state: 'deleted', staged: false },
  { path: 'README.md', state: 'modified', staged: false },
])

const branches = ref<Branch[]>([
  { name: 'feat/examples', ahead: 2, behind: 0 },
  { name: 'main', ahead: 0, behind: 1 },
  { name: 'docs/quick-start', ahead: 0, behind: 0 },
  { name: 'refactor/node-ops', ahead: 4, behind: 2 },
])

const commits = ref<Commit[]>([
  {
    hash: '9df8c22',
    message: 'feat: add terminal image component',
    author: 'posva',
    age: '18m',
    pushed: false,
  },
  {
    hash: '1ca84b9',
    message: 'docs: document component recipes',
    author: 'posva',
    age: '2h',
    pushed: false,
  },
  {
    hash: 'b691e80',
    message: 'fix: preserve fragment anchors',
    author: 'yyx990803',
    age: '1d',
    pushed: true,
  },
  {
    hash: '74cc14a',
    message: 'test: cover textarea submit behavior',
    author: 'posva',
    age: '2d',
    pushed: true,
  },
  {
    hash: '4051ed7',
    message: 'chore: update OpenTUI',
    author: 'dependabot',
    age: '4d',
    pushed: true,
  },
])

const logs = ref(['Repository loaded in 42ms', 'git status --short', '6 changed files · 2 staged'])

const { width, height } = useTerminalSize()
const exit = useExit()
useTitle(() => `LazyVue — ${currentBranch.value}`)

const stagedCount = computed(() => files.value.filter((file) => file.staged).length)
const compact = computed(() => width.value < 92)
const short = computed(() => height.value < 27)
const activeTitle = computed(() => panels[activePanel.value] ?? panels[0])
const ahead = computed(
  () => branches.value.find((branch) => branch.name === currentBranch.value)?.ahead ?? 0,
)

function addLog(message: string): void {
  logs.value.unshift(message)
  selectedLog.value = 0
}

function moveSelection(step: number): void {
  const indexes = [selectedFile, selectedBranch, selectedCommit, selectedLog]
  const sizes = [files.value.length, branches.value.length, commits.value.length, logs.value.length]
  const index = indexes[activePanel.value]
  const size = sizes[activePanel.value] ?? 0
  if (!index || !size) return
  index.value = (index.value + step + size) % size
}

function toggleStage(): void {
  const file = files.value[selectedFile.value]
  if (!file) return
  file.staged = !file.staged
  addLog(`${file.staged ? 'Staged' : 'Unstaged'} ${file.path}`)
}

function checkoutBranch(): void {
  const branch = branches.value[selectedBranch.value]
  if (!branch || branch.name === currentBranch.value) return
  currentBranch.value = branch.name
  addLog(`Checked out ${branch.name}`)
}

function activateSelection(): void {
  if (activePanel.value === 0) toggleStage()
  else if (activePanel.value === 1) checkoutBranch()
  else if (activePanel.value === 2) {
    const commit = commits.value[selectedCommit.value]
    if (commit) addLog(`Opened commit ${commit.hash}`)
  }
}

function openCommit(): void {
  if (!stagedCount.value) {
    addLog('Nothing staged to commit')
    return
  }
  commitMessage.value = ''
  commitVisible.value = true
}

function createCommit(): void {
  const message = commitMessage.value.trim()
  if (!message) return
  const committed = files.value.filter((file) => file.staged)
  files.value = files.value.filter((file) => !file.staged)
  commits.value.unshift({
    hash: Math.random().toString(16).slice(2, 9),
    message,
    author: 'you',
    age: 'now',
    pushed: false,
  })
  const branch = branches.value.find((item) => item.name === currentBranch.value)
  if (branch) branch.ahead++
  selectedFile.value = Math.min(selectedFile.value, Math.max(0, files.value.length - 1))
  selectedCommit.value = 0
  commitVisible.value = false
  addLog(`Committed ${committed.length} file${committed.length === 1 ? '' : 's'}: ${message}`)
}

function push(): void {
  commits.value.forEach((commit) => {
    commit.pushed = true
  })
  const branch = branches.value.find((item) => item.name === currentBranch.value)
  if (branch) branch.ahead = 0
  addLog(`Pushed ${currentBranch.value} to origin`)
}

function pull(): void {
  const branch = branches.value.find((item) => item.name === currentBranch.value)
  if (branch) branch.behind = 0
  addLog(`Pulled origin/${currentBranch.value} (already up to date)`)
}

onKeyDown((key) => {
  if (commitVisible.value) {
    if (key.name === 'escape') commitVisible.value = false
    return
  }

  if (helpVisible.value) {
    if (key.name === 'escape' || key.name === '?' || key.name === 'q') helpVisible.value = false
    return
  }

  if (key.name === 'q') exit()
  else if (key.name === '?' || (key.shift && key.name === '/')) helpVisible.value = true
  else if (key.name === 'tab') {
    key.preventDefault()
    activePanel.value = (activePanel.value + (key.shift ? -1 : 1) + panels.length) % panels.length
  } else if (/^[1-4]$/.test(key.name)) activePanel.value = Number(key.name) - 1
  else if (key.name === 'up' || key.name === 'k') moveSelection(-1)
  else if (key.name === 'down' || key.name === 'j') moveSelection(1)
  else if (key.name === 'space' || key.name === 'return') activateSelection()
  else if (key.name === 'c') openCommit()
  else if (key.name === 'p' && key.shift) pull()
  else if (key.name === 'p') push()
  else if (key.name === 'f') addLog('Fetched origin · 1 remote updated')
  else if (key.name === 'r') addLog('Refreshed working tree')
})

function stateGlyph(state: FileState): string {
  return state === 'modified' ? 'M' : state === 'added' ? 'A' : 'D'
}

function stateColor(state: FileState): string {
  return state === 'modified' ? yellow : state === 'added' ? green : red
}

function commitLabel(commit: Commit): string {
  const hash = compact.value ? '' : `${commit.hash} `
  return `${hash}${commit.message} · ${commit.author} ${commit.age}`
}
</script>

<template>
  <Box flexDirection="column" :flexGrow="1" backgroundColor="#101419">
    <Box
      flexDirection="row"
      justifyContent="space-between"
      :paddingX="1"
      backgroundColor="#202830"
      :flexShrink="0"
    >
      <Text bold :fg="green">LazyVue</Text>
      <Text v-if="!compact" fg="#c9d1d9">vuejs/vue-termui</Text>
      <Text :fg="ahead ? yellow : muted">{{ currentBranch }} ↑{{ ahead }}</Text>
    </Box>

    <Box flexDirection="row" :flexGrow="1" :padding="1" :gap="1" overflow="hidden">
      <Box flexDirection="column" :width="compact ? '46%' : '40%'" :gap="1">
        <Panel title="1 Files" :active="activePanel === 0" :height="short ? '58%' : '52%'">
          <Text v-if="!files.length" :fg="muted">Working tree clean</Text>
          <Text
            v-for="(file, index) in files"
            :key="file.path"
            :fg="index === selectedFile ? '#ffffff' : stateColor(file.state)"
            :bg="activePanel === 0 && index === selectedFile ? '#2b3942' : undefined"
            :bold="activePanel === 0 && index === selectedFile"
            >{{ index === selectedFile ? '›' : ' ' }} {{ file.staged ? '●' : '○' }}
            {{ stateGlyph(file.state) }}
            {{ compact ? file.path.split('/').at(-1) : file.path }}</Text
          >
        </Panel>

        <Panel title="2 Branches" :active="activePanel === 1" :height="short ? '42%' : '48%'">
          <Text
            v-for="(branch, index) in branches"
            :key="branch.name"
            :fg="
              branch.name === currentBranch
                ? green
                : index === selectedBranch
                  ? '#ffffff'
                  : '#b6bec8'
            "
            :bg="activePanel === 1 && index === selectedBranch ? '#2b3942' : undefined"
            :bold="branch.name === currentBranch"
            >{{ index === selectedBranch ? '›' : ' ' }}
            {{ branch.name === currentBranch ? '*' : ' ' }} {{ branch.name
            }}{{ branch.ahead ? ` ↑${branch.ahead}` : ''
            }}{{ branch.behind ? ` ↓${branch.behind}` : '' }}</Text
          >
        </Panel>
      </Box>

      <Box flexDirection="column" :flexGrow="1" :gap="1" overflow="hidden">
        <Panel title="3 Commits" :active="activePanel === 2" :height="short ? '67%' : '62%'">
          <Text
            v-for="(commit, index) in commits"
            :key="commit.hash"
            :fg="index === selectedCommit ? '#ffffff' : commit.pushed ? '#b6bec8' : yellow"
            :bg="activePanel === 2 && index === selectedCommit ? '#2b3942' : undefined"
            :bold="activePanel === 2 && index === selectedCommit"
            >{{ index === selectedCommit ? '›' : ' ' }} {{ commit.pushed ? '◆' : '●' }}
            {{ commitLabel(commit) }}</Text
          >
        </Panel>

        <Panel title="4 Command log" :active="activePanel === 3" :height="short ? '33%' : '38%'">
          <Text
            v-for="(log, index) in logs.slice(0, short ? 3 : 6)"
            :key="`${index}-${log}`"
            :fg="index === selectedLog ? blue : muted"
            :bg="activePanel === 3 && index === selectedLog ? '#2b3942' : undefined"
            >{{ index === selectedLog ? '›' : ' ' }} {{ log }}</Text
          >
        </Panel>
      </Box>
    </Box>

    <Box
      flexDirection="row"
      justifyContent="space-between"
      :paddingX="1"
      backgroundColor="#202830"
      :flexShrink="0"
    >
      <Text fg="#d6dde5">{{ activeTitle }} · ↑↓/jk move · space/enter select</Text>
      <Text :fg="muted">c commit · p push · P pull · ? help · q quit</Text>
    </Box>

    <Box
      v-if="helpVisible || commitVisible"
      position="absolute"
      top="15%"
      left="20%"
      width="60%"
      :height="helpVisible ? 16 : 9"
      :zIndex="10"
      flexDirection="column"
      :border="true"
      borderStyle="double"
      :borderColor="green"
      backgroundColor="#171c22"
      :padding="1"
      :gap="1"
      :title="helpVisible ? ' Keyboard shortcuts ' : ' Commit staged changes '"
      :titleColor="green"
    >
      <template v-if="helpVisible">
        <Text bold :fg="green">Navigation</Text>
        <Text>1–4 / tab switch panels ↑↓ / j k move selection</Text>
        <Text>space/enter stage file or checkout selected branch</Text>
        <Text bold :fg="green">Repository</Text>
        <Text>c commit p push P pull f fetch r refresh</Text>
        <Text bold :fg="green">Application</Text>
        <Text>? help esc close overlay q quit</Text>
        <Text :fg="muted"
          >This example uses in-memory repository data and never changes your files.</Text
        >
      </template>
      <template v-else>
        <Text :fg="muted">{{ stagedCount }} staged file{{ stagedCount === 1 ? '' : 's' }}</Text>
        <Input
          v-model="commitMessage"
          width="100%"
          placeholder="Commit message"
          autofocus
          @enter="createCommit"
        />
        <Text :fg="muted">enter commit · esc cancel</Text>
      </template>
    </Box>
  </Box>
</template>
