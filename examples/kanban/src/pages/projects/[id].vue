<script setup lang="ts">
import {
  Box,
  computed,
  Input,
  Markdown,
  nextTick,
  onKeyDown,
  onMounted,
  ref,
  ScrollBox,
  shallowRef,
  SyntaxStyle,
  Text,
  useExit,
  useRenderer,
  useTerminalSize,
  type MouseEvent,
  type ScrollBoxElement,
} from 'vue-termui'
import { useRoute, useRouter } from 'vue-router'
import {
  createDraftCard,
  fetchProject,
  moveCardAfter,
  removeCard,
  setCardStatus,
  updateCardTitle,
  type GitHubProject,
  type ProjectCard,
} from '../../github'
import { connectedProjects } from '../../projects'

interface DraggedCard {
  cardId: string
  sourceColumn: number
}

const CARD_HEIGHT = 5
const COLUMN_WIDTH = 32
const STRIPED_BORDER = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '┄',
  vertical: '┆',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
}

const route = useRoute()
const router = useRouter()
const connection = computed(() =>
  connectedProjects.value.find(
    ({ id }) => id === ('id' in route.params ? String(route.params.id) : ''),
  ),
)
const project = ref<GitHubProject | null>(null)
const loading = ref(false)
const syncing = ref(false)
const error = ref('')
const activeColumn = ref(0)
const selections = ref<number[]>([])
const modal = ref<'add' | 'edit' | null>(null)
const detailCard = ref<ProjectCard | null>(null)
const draft = ref('')
const draggedCard = ref<DraggedCard | null>(null)
const dragActive = ref(false)
const dragX = ref(0)
const dragY = ref(0)
const dragCardWidth = ref(16)
const dropColumn = ref<number | null>(null)
const dropIndex = ref<number | null>(null)
const boardScroller = shallowRef<ScrollBoxElement | null>(null)
const columnScrollers = new Map<number, ScrollBoxElement>()
const exit = useExit()
const renderer = useRenderer()
const { width, height } = useTerminalSize()
const markdownStyle = SyntaxStyle.fromStyles({
  default: { fg: '#e6edf3' },
  'markup.heading': { fg: '#58a6ff', bold: true },
  'markup.heading.1': { fg: '#58a6ff', bold: true },
  'markup.heading.2': { fg: '#79c0ff', bold: true },
  'markup.heading.3': { fg: '#d2a8ff', bold: true },
  'markup.bold': { fg: '#f0f6fc', bold: true },
  'markup.strong': { fg: '#f0f6fc', bold: true },
  'markup.italic': { fg: '#f0f6fc', italic: true },
  'markup.list': { fg: '#ff7b72' },
  'markup.quote': { fg: '#8b949e', italic: true },
  'markup.raw': { fg: '#a5d6ff', bg: '#161b22' },
  'markup.raw.block': { fg: '#a5d6ff', bg: '#161b22' },
  'markup.raw.inline': { fg: '#a5d6ff', bg: '#161b22' },
  'markup.link': { fg: '#58a6ff', underline: true },
  'markup.link.label': { fg: '#a5d6ff', underline: true },
  'markup.link.url': { fg: '#58a6ff', underline: true },
  keyword: { fg: '#ff7b72', bold: true },
  string: { fg: '#a5d6ff' },
  comment: { fg: '#8b949e', italic: true },
  number: { fg: '#79c0ff' },
  function: { fg: '#d2a8ff' },
  type: { fg: '#ffa657' },
  operator: { fg: '#ff7b72' },
  variable: { fg: '#e6edf3' },
  property: { fg: '#79c0ff' },
  label: { fg: '#7ee787' },
  'punctuation.bracket': { fg: '#f0f6fc' },
  'punctuation.delimiter': { fg: '#c9d1d9' },
  'diff.plus': { fg: '#3fb950' },
  'diff.minus': { fg: '#f85149' },
  conceal: { fg: '#6e7681' },
})

const columns = computed(() => project.value?.columns ?? [])
const cardCount = computed(() =>
  columns.value.reduce((count, column) => count + column.cards.length, 0),
)
const boardWidth = computed(() =>
  Math.max(width.value - 2, columns.value.length * COLUMN_WIDTH + columns.value.length - 1),
)
const draggedCardData = computed(() => {
  const dragged = draggedCard.value
  if (!dragged) return undefined
  return columns.value[dragged.sourceColumn]?.cards.find((card) => card.id === dragged.cardId)
})
const dragGhostLeft = computed(() =>
  dragX.value + dragCardWidth.value + 1 < width.value
    ? dragX.value + 1
    : Math.max(0, dragX.value - dragCardWidth.value - 1),
)
const dragGhostTop = computed(() =>
  Math.max(0, Math.min(dragY.value - 2, height.value - CARD_HEIGHT)),
)
const detailMarkdown = computed(() => {
  const card = detailCard.value
  if (!card) return ''

  const type = card.contentType === 'PullRequest' ? 'Pull request' : card.contentType
  const location = card.repository && card.number ? `${card.repository}#${card.number}` : type
  const metadata = [location, card.state, card.author ? `@${card.author}` : null]
    .filter(Boolean)
    .join(' · ')
  const fields: string[] = []
  if (card.assignees.length) {
    fields.push(`**Assignees:** ${card.assignees.map((name) => `@${name}`).join(', ')}`)
  }
  if (card.labels.length) fields.push(`**Labels:** ${card.labels.join(', ')}`)
  if (card.url) fields.push(`[Open on GitHub](${card.url})`)

  return [
    `# ${card.title.replaceAll('\n', ' ')}`,
    `> ${metadata}`,
    ...fields,
    '---',
    card.body.trim() || '_No description provided._',
  ].join('\n\n')
})

function scrollBoxElement(instance: unknown): ScrollBoxElement | null {
  if (!instance || typeof instance !== 'object') return null
  if ('$el' in instance) return (instance as { $el: ScrollBoxElement }).$el
  return instance as ScrollBoxElement
}

function setBoardScroller(instance: unknown): void {
  boardScroller.value = scrollBoxElement(instance)
}

function setColumnScroller(columnIndex: number, instance: unknown): void {
  const element = scrollBoxElement(instance)
  if (element) columnScrollers.set(columnIndex, element)
  else columnScrollers.delete(columnIndex)
}

async function revealSelection(): Promise<void> {
  await nextTick()
  const columnIndex = activeColumn.value
  boardScroller.value?.scrollChildIntoView(`kanban-column-${columnIndex}`)
  const cardIndex = selections.value[columnIndex] ?? 0
  const card = columns.value[columnIndex]?.cards[cardIndex]
  if (card) columnScrollers.get(columnIndex)?.scrollChildIntoView(`kanban-card-${card.id}`)
}

async function load(): Promise<void> {
  const selected = connection.value
  if (!selected) {
    error.value = 'This project is no longer connected'
    return
  }
  loading.value = true
  error.value = ''
  try {
    project.value = await fetchProject(selected)
    selections.value = project.value.columns.map((_, index) => selections.value[index] ?? 0)
    activeColumn.value = Math.min(activeColumn.value, Math.max(project.value.columns.length - 1, 0))
    await revealSelection()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

async function sync(action: () => Promise<void>): Promise<void> {
  if (syncing.value) return
  syncing.value = true
  error.value = ''
  try {
    await action()
    await load()
  } catch (cause) {
    const actionError = cause instanceof Error ? cause.message : String(cause)
    await load()
    error.value = error.value ? `${actionError}; refresh failed: ${error.value}` : actionError
  } finally {
    syncing.value = false
  }
}

function currentCard(): ProjectCard | undefined {
  return columns.value[activeColumn.value]?.cards[selections.value[activeColumn.value] ?? 0]
}

function moveColumn(step: number): void {
  if (!columns.value.length) return
  activeColumn.value = (activeColumn.value + step + columns.value.length) % columns.value.length
  void revealSelection()
}

function moveCard(step: number): void {
  const cards = columns.value[activeColumn.value]?.cards ?? []
  if (!cards.length) return
  const index = selections.value[activeColumn.value] ?? 0
  selections.value[activeColumn.value] = (index + step + cards.length) % cards.length
  void revealSelection()
}

async function moveToColumn(
  sourceColumn: number,
  sourceIndex: number,
  targetColumn: number,
  targetIndex: number,
): Promise<void> {
  const board = project.value
  const source = columns.value[sourceColumn]
  const destination = columns.value[targetColumn]
  const card = source?.cards[sourceIndex]
  if (!board || !source || !destination || !card) return
  if (sourceColumn !== targetColumn && !board.statusFieldId) {
    error.value = 'This project needs a Status single-select field to move cards between columns'
    return
  }

  const adjustedIndex = Math.max(
    0,
    Math.min(
      targetIndex - (source === destination && sourceIndex < targetIndex ? 1 : 0),
      destination.cards.length,
    ),
  )
  const destinationCards = destination.cards.filter(({ id }) => id !== card.id)
  const afterId = destinationCards[adjustedIndex - 1]?.id ?? null
  activeColumn.value = targetColumn
  selections.value[targetColumn] = adjustedIndex
  void revealSelection()
  await sync(async () => {
    if (sourceColumn !== targetColumn && board.statusFieldId) {
      await setCardStatus(board.id, card.id, board.statusFieldId!, destination.id)
    }
    await moveCardAfter(board.id, card.id, afterId)
  })
}

async function advanceCard(): Promise<void> {
  const sourceIndex = selections.value[activeColumn.value] ?? 0
  const destinationIndex = (activeColumn.value + 1) % columns.value.length
  await moveToColumn(
    activeColumn.value,
    sourceIndex,
    destinationIndex,
    columns.value[destinationIndex]?.cards.length ?? 0,
  )
}

function openAdd(): void {
  draft.value = ''
  modal.value = 'add'
}

function openEdit(): void {
  const card = currentCard()
  if (!card) return
  draft.value = card.title
  modal.value = 'edit'
}

function openDetails(card = currentCard()): void {
  if (card) detailCard.value = card
}

async function save(): Promise<void> {
  const board = project.value
  const title = draft.value.trim()
  if (!board || !title) return
  const mode = modal.value
  const card = currentCard()
  modal.value = null
  await sync(async () => {
    if (mode === 'add') {
      const itemId = await createDraftCard(board.id, title)
      const column = columns.value[activeColumn.value]
      if (board.statusFieldId && column?.id) {
        await setCardStatus(board.id, itemId, board.statusFieldId, column.id)
      }
    } else if (card) {
      await updateCardTitle(card, title)
    }
  })
}

async function remove(): Promise<void> {
  const board = project.value
  const card = currentCard()
  if (!board || !card) return
  await sync(() => removeCard(board.id, card.id))
}

function selectCard(columnIndex: number, cardIndex: number): void {
  activeColumn.value = columnIndex
  selections.value[columnIndex] = cardIndex
  void revealSelection()
}

function clickCard(columnIndex: number, cardIndex: number, event: MouseEvent): void {
  const wasDragging = dragActive.value
  finishDrag()
  if (wasDragging) return
  selectCard(columnIndex, cardIndex)
  openDetails(columns.value[columnIndex]?.cards[cardIndex])
  event.stopPropagation()
}

function startDrag(columnIndex: number, cardIndex: number, event: MouseEvent): void {
  if (event.button !== 0 || syncing.value) return
  const card = columns.value[columnIndex]?.cards[cardIndex]
  if (!card) return
  selectCard(columnIndex, cardIndex)
  draggedCard.value = { cardId: card.id, sourceColumn: columnIndex }
  dragActive.value = false
  dragX.value = event.x
  dragY.value = event.y
  dragCardWidth.value = renderer.root.findDescendantById(`kanban-card-${card.id}`)?.width ?? 16
  dropColumn.value = columnIndex
  dropIndex.value = cardIndex
  event.stopPropagation()
}

function moveDrag(event: MouseEvent): void {
  if (!draggedCard.value) return
  dragActive.value = true
  dragX.value = event.x
  dragY.value = event.y
  boardScroller.value?.updateAutoScroll(event.x, event.y)
  if (dropColumn.value !== null) {
    columnScrollers.get(dropColumn.value)?.updateAutoScroll(event.x, event.y)
  }
  event.stopPropagation()
}

function dragOverColumn(columnIndex: number, event: MouseEvent): void {
  if (!dragActive.value) return
  dropColumn.value = columnIndex
  dropIndex.value = columns.value[columnIndex]?.cards.length ?? 0
  event.stopPropagation()
}

function dragOverCard(columnIndex: number, cardIndex: number, event: MouseEvent): void {
  if (!dragActive.value) return
  dropColumn.value = columnIndex
  dropIndex.value = cardIndex
  event.stopPropagation()
}

function dropCard(columnIndex: number, targetIndex: number, event: MouseEvent): void {
  const dragged = draggedCard.value
  if (!dragged || !dragActive.value) return
  const sourceIndex =
    columns.value[dragged.sourceColumn]?.cards.findIndex(({ id }) => id === dragged.cardId) ?? -1
  if (sourceIndex >= 0) {
    void moveToColumn(dragged.sourceColumn, sourceIndex, columnIndex, targetIndex)
  }
  draggedCard.value = null
  dragActive.value = false
  dropColumn.value = null
  dropIndex.value = null
  event.stopPropagation()
}

function finishDrag(): void {
  boardScroller.value?.stopAutoScroll()
  for (const scroller of columnScrollers.values()) scroller.stopAutoScroll()
  queueMicrotask(() => {
    draggedCard.value = null
    dragActive.value = false
    dropColumn.value = null
    dropIndex.value = null
  })
}

onKeyDown((key) => {
  if (detailCard.value) {
    if (key.name === 'escape' || key.name === 'q' || key.name === 'return') {
      detailCard.value = null
    }
    return
  }
  if (modal.value) {
    if (key.name === 'escape') modal.value = null
    return
  }
  if (key.name === 'q') exit()
  else if (key.name === 'b' || key.name === 'escape') void router.push('/')
  else if (key.name === 'r') void load()
  else if (syncing.value) return
  else if (key.name === 'left' || key.name === 'h') moveColumn(-1)
  else if (key.name === 'right' || key.name === 'l') moveColumn(1)
  else if (key.name === 'up' || key.name === 'k') moveCard(-1)
  else if (key.name === 'down' || key.name === 'j') moveCard(1)
  else if (key.name === 'return') openDetails()
  else if (key.name === 'm') void advanceCard()
  else if (key.name === 'a') openAdd()
  else if (key.name === 'e') openEdit()
  else if (key.name === 'd') void remove()
})

onMounted(() => void load())
</script>

<template>
  <Box flexDirection="column" :flexGrow="1">
    <Box flexDirection="row" justifyContent="space-between" :paddingX="1" :flexShrink="0">
      <Text bold fg="#e7edf3">{{ project?.title || connection?.title || 'GitHub Project' }}</Text>
      <Text :fg="error ? '#e06c75' : syncing || loading ? '#e5c07b' : '#42b883'">
        {{ error || (syncing ? 'Syncing…' : loading ? 'Loading…' : project ? 'Synced' : '') }}
      </Text>
      <Text fg="#7f8a96">{{ cardCount }} items</Text>
    </Box>

    <ScrollBox
      v-if="project"
      :ref="setBoardScroller"
      :flexGrow="1"
      :flexShrink="1"
      :scrollX="true"
      :scrollY="false"
      :focusable="false"
      :padding="1"
      overflow="hidden"
    >
      <Box flexDirection="row" :width="boardWidth" height="100%" :gap="1" :flexShrink="0">
        <ScrollBox
          v-for="(column, columnIndex) in columns"
          :id="`kanban-column-${columnIndex}`"
          :key="column.id || 'none'"
          :ref="(instance) => setColumnScroller(columnIndex, instance)"
          :width="COLUMN_WIDTH"
          height="100%"
          :flexShrink="0"
          :border="true"
          borderStyle="rounded"
          :borderColor="
            dropColumn === columnIndex
              ? '#ffffff'
              : activeColumn === columnIndex
                ? column.color
                : '#46505a'
          "
          :title="` ${column.title} · ${column.cards.length} `"
          :titleColor="column.color"
          :paddingX="1"
          :scrollX="false"
          :scrollY="true"
          :focusable="false"
          overflow="hidden"
          @mouse-drag="moveDrag"
          @mouse-over="(event) => dragOverColumn(columnIndex, event)"
          @mouse-drop="(event) => dropCard(columnIndex, column.cards.length, event)"
        >
          <Box v-for="(card, cardIndex) in column.cards" :key="card.id" flexDirection="column">
            <Box
              v-if="dragActive && dropColumn === columnIndex && dropIndex === cardIndex"
              :height="CARD_HEIGHT"
              :flexShrink="0"
              :border="true"
              :customBorderChars="STRIPED_BORDER"
              borderColor="#8b949e"
              :shouldFill="false"
              :marginBottom="1"
              @mouse-over="(event) => dragOverCard(columnIndex, cardIndex, event)"
              @mouse-drop="(event) => dropCard(columnIndex, cardIndex, event)"
            />
            <Box
              :id="`kanban-card-${card.id}`"
              flexDirection="column"
              :height="CARD_HEIGHT"
              :flexShrink="0"
              :border="true"
              borderStyle="rounded"
              :borderColor="
                activeColumn === columnIndex && selections[columnIndex] === cardIndex
                  ? column.color
                  : '#46505a'
              "
              :backgroundColor="
                activeColumn === columnIndex && selections[columnIndex] === cardIndex
                  ? '#26323b'
                  : '#171c22'
              "
              :opacity="dragActive && draggedCard?.cardId === card.id ? 0.35 : 1"
              :paddingX="1"
              :marginBottom="1"
              overflow="hidden"
              @mouse-down="(event) => startDrag(columnIndex, cardIndex, event)"
              @mouse-up="(event) => clickCard(columnIndex, cardIndex, event)"
              @mouse-drag-end="finishDrag"
              @mouse-over="(event) => dragOverCard(columnIndex, cardIndex, event)"
              @mouse-drop="(event) => dropCard(columnIndex, cardIndex, event)"
            >
              <Text
                :bold="activeColumn === columnIndex && selections[columnIndex] === cardIndex"
                fg="#e7edf3"
                :selectable="false"
                >{{ card.title }}</Text
              >
              <Text fg="#7f8a96" :selectable="false">{{ card.subtitle }}</Text>
            </Box>
          </Box>
          <Box
            v-if="dragActive && dropColumn === columnIndex && dropIndex === column.cards.length"
            :height="CARD_HEIGHT"
            :flexShrink="0"
            :border="true"
            :customBorderChars="STRIPED_BORDER"
            borderColor="#8b949e"
            :shouldFill="false"
            :marginBottom="1"
            @mouse-over="(event) => dragOverColumn(columnIndex, event)"
            @mouse-drop="(event) => dropCard(columnIndex, column.cards.length, event)"
          />
          <Text
            v-if="!column.cards.length && !(dragActive && dropColumn === columnIndex)"
            fg="#7f8a96"
            >No items</Text
          >
        </ScrollBox>
      </Box>
    </ScrollBox>

    <Box v-else :flexGrow="1" justifyContent="center" alignItems="center">
      <Text :fg="error ? '#e06c75' : '#7f8a96'">{{ error || 'Loading project…' }}</Text>
    </Box>

    <Box
      flexDirection="row"
      justifyContent="space-between"
      backgroundColor="#202830"
      :paddingX="1"
      :flexShrink="0"
    >
      <Text fg="#d6dde5"
        >enter/click details · drag/scroll · arrows/hjkl · m move · a add · e edit</Text
      >
      <Text fg="#7f8a96">b projects · q quit</Text>
    </Box>

    <Box
      v-if="dragActive && draggedCardData"
      position="absolute"
      :left="dragGhostLeft"
      :top="dragGhostTop"
      :width="dragCardWidth"
      :height="CARD_HEIGHT"
      :zIndex="100"
      flexDirection="column"
      :border="true"
      borderStyle="rounded"
      borderColor="#ffffff"
      backgroundColor="#26323b"
      :opacity="0.9"
      :paddingX="1"
      overflow="hidden"
    >
      <Text bold fg="#e7edf3" :selectable="false">{{ draggedCardData.title }}</Text>
      <Text fg="#7f8a96" :selectable="false">{{ draggedCardData.subtitle }}</Text>
    </Box>

    <Box
      v-if="detailCard"
      position="absolute"
      top="8%"
      left="8%"
      width="84%"
      height="84%"
      :zIndex="250"
      flexDirection="column"
      :border="true"
      borderStyle="double"
      borderColor="#58a6ff"
      backgroundColor="#0d1117"
      :padding="1"
      title=" Ticket details "
    >
      <ScrollBox
        :flexGrow="1"
        :flexShrink="1"
        :scrollX="false"
        :scrollY="true"
        autofocus
        :paddingRight="1"
      >
        <Box width="100%" flexDirection="column" :flexGrow="0" :flexShrink="0">
          <Markdown
            width="100%"
            :flexShrink="0"
            :content="detailMarkdown"
            :syntax-style="markdownStyle"
            :tableOptions="{
              style: 'grid',
              widthMode: 'full',
              wrapMode: 'word',
            }"
            internalBlockMode="top-level"
            fg="#e6edf3"
            bg="#0d1117"
            conceal
            concealCode
          />
        </Box>
      </ScrollBox>
      <Text fg="#8b949e">↑↓/jk/page scroll · esc/enter close</Text>
    </Box>

    <Box
      v-if="modal"
      position="absolute"
      top="30%"
      left="20%"
      width="60%"
      :height="8"
      :zIndex="200"
      flexDirection="column"
      :border="true"
      borderStyle="double"
      borderColor="#42b883"
      backgroundColor="#171c22"
      :padding="1"
      :title="modal === 'add' ? ' Add draft item ' : ' Edit item title '"
    >
      <Input v-model="draft" width="100%" placeholder="Item title" autofocus @enter="save" />
      <Text fg="#7f8a96">enter save to GitHub · esc cancel</Text>
    </Box>
  </Box>
</template>
