<script setup lang="ts">
import {
  Box,
  Input,
  onKeyDown,
  ref,
  Text,
  useExit,
  useTerminalSize,
  useTitle,
  type MouseEvent,
} from 'vue-termui'

interface Card {
  id: number
  title: string
  tag: string
  priority: 'low' | 'medium' | 'high'
}

interface Column {
  title: string
  color: string
  cards: Card[]
}

interface DraggedCard {
  cardId: number
  sourceColumn: number
}

const columns = ref<Column[]>([
  {
    title: 'BACKLOG',
    color: '#7f8a96',
    cards: [
      { id: 1, title: 'Keyboard shortcuts', tag: 'DX', priority: 'medium' },
      { id: 2, title: 'Mouse interactions', tag: 'UX', priority: 'low' },
      { id: 3, title: 'Export board JSON', tag: 'CORE', priority: 'low' },
    ],
  },
  {
    title: 'IN PROGRESS',
    color: '#61afef',
    cards: [
      { id: 4, title: 'Build terminal layout', tag: 'UI', priority: 'high' },
      { id: 5, title: 'Responsive columns', tag: 'UI', priority: 'medium' },
    ],
  },
  {
    title: 'REVIEW',
    color: '#e5c07b',
    cards: [{ id: 6, title: 'Add component tests', tag: 'TEST', priority: 'high' }],
  },
  {
    title: 'DONE',
    color: '#42b883',
    cards: [
      { id: 7, title: 'Project scaffold', tag: 'CORE', priority: 'low' },
      { id: 8, title: 'Theme tokens', tag: 'UI', priority: 'medium' },
    ],
  },
])

const activeColumn = ref(0)
const selections = ref([0, 0, 0, 0])
const modal = ref<'add' | 'edit' | null>(null)
const draft = ref('')
const nextId = ref(9)
const draggedCard = ref<DraggedCard | null>(null)
const dropColumn = ref<number | null>(null)
const dropIndex = ref<number | null>(null)
const exit = useExit()
const { width } = useTerminalSize()
useTitle('VueBoard')

function currentCard(): Card | undefined {
  return columns.value[activeColumn.value]?.cards[selections.value[activeColumn.value] ?? 0]
}

function moveColumn(step: number): void {
  activeColumn.value = (activeColumn.value + step + columns.value.length) % columns.value.length
}

function moveCard(step: number): void {
  const cards = columns.value[activeColumn.value]?.cards ?? []
  if (!cards.length) return
  const index = selections.value[activeColumn.value] ?? 0
  selections.value[activeColumn.value] = (index + step + cards.length) % cards.length
}

function advanceCard(): void {
  const source = columns.value[activeColumn.value]
  const index = selections.value[activeColumn.value] ?? 0
  const card = source?.cards[index]
  if (!source || !card) return
  source.cards.splice(index, 1)
  const destinationIndex = (activeColumn.value + 1) % columns.value.length
  columns.value[destinationIndex]!.cards.push(card)
  selections.value[activeColumn.value] = Math.max(0, Math.min(index, source.cards.length - 1))
  activeColumn.value = destinationIndex
  selections.value[destinationIndex] = columns.value[destinationIndex]!.cards.length - 1
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

function save(): void {
  const title = draft.value.trim()
  if (!title) return
  const column = columns.value[activeColumn.value]
  if (!column) return
  if (modal.value === 'add') {
    column.cards.push({ id: nextId.value++, title, tag: 'NEW', priority: 'medium' })
    selections.value[activeColumn.value] = column.cards.length - 1
  } else {
    const card = currentCard()
    if (card) card.title = title
  }
  modal.value = null
}

function remove(): void {
  const column = columns.value[activeColumn.value]
  const index = selections.value[activeColumn.value] ?? 0
  if (!column?.cards[index]) return
  column.cards.splice(index, 1)
  selections.value[activeColumn.value] = Math.max(0, Math.min(index, column.cards.length - 1))
}

function priorityColor(priority: Card['priority']): string {
  return priority === 'high' ? '#e06c75' : priority === 'medium' ? '#e5c07b' : '#7f8a96'
}

function selectCard(columnIndex: number, cardIndex: number): void {
  activeColumn.value = columnIndex
  selections.value[columnIndex] = cardIndex
}

function startDrag(columnIndex: number, cardIndex: number, event: MouseEvent): void {
  if (event.button !== 0) return
  const card = columns.value[columnIndex]?.cards[cardIndex]
  if (!card) return

  selectCard(columnIndex, cardIndex)
  draggedCard.value = { cardId: card.id, sourceColumn: columnIndex }
  dropColumn.value = columnIndex
  dropIndex.value = cardIndex
  event.stopPropagation()
}

function dragOverColumn(columnIndex: number, event: MouseEvent): void {
  if (!draggedCard.value) return
  dropColumn.value = columnIndex
  dropIndex.value = columns.value[columnIndex]?.cards.length ?? 0
  event.stopPropagation()
}

function dragOverCard(columnIndex: number, cardIndex: number, event: MouseEvent): void {
  if (!draggedCard.value) return
  dropColumn.value = columnIndex
  dropIndex.value = cardIndex
  event.stopPropagation()
}

function dropCard(columnIndex: number, targetIndex: number, event: MouseEvent): void {
  const dragged = draggedCard.value
  if (!dragged) return

  const source = columns.value[dragged.sourceColumn]
  const destination = columns.value[columnIndex]
  const sourceIndex = source?.cards.findIndex((card) => card.id === dragged.cardId) ?? -1
  if (!source || !destination || sourceIndex < 0) return

  const [card] = source.cards.splice(sourceIndex, 1)
  if (!card) return

  const insertionIndex = Math.max(
    0,
    Math.min(
      targetIndex - (source === destination && sourceIndex < targetIndex ? 1 : 0),
      destination.cards.length,
    ),
  )
  destination.cards.splice(insertionIndex, 0, card)

  selections.value[dragged.sourceColumn] = Math.max(
    0,
    Math.min(selections.value[dragged.sourceColumn] ?? 0, source.cards.length - 1),
  )
  activeColumn.value = columnIndex
  selections.value[columnIndex] = insertionIndex
  draggedCard.value = null
  dropColumn.value = null
  dropIndex.value = null
  event.stopPropagation()
}

function finishDrag(): void {
  // OpenTUI emits drag-end immediately before drop, so defer cleanup until the
  // drop target has had a chance to move the card.
  queueMicrotask(() => {
    draggedCard.value = null
    dropColumn.value = null
    dropIndex.value = null
  })
}

onKeyDown((key) => {
  if (modal.value) {
    if (key.name === 'escape') modal.value = null
    return
  }
  if (key.name === 'q') exit()
  else if (key.name === 'left' || key.name === 'h') moveColumn(-1)
  else if (key.name === 'right' || key.name === 'l') moveColumn(1)
  else if (key.name === 'up' || key.name === 'k') moveCard(-1)
  else if (key.name === 'down' || key.name === 'j') moveCard(1)
  else if (key.name === 'm' || key.name === 'return') advanceCard()
  else if (key.name === 'a') openAdd()
  else if (key.name === 'e') openEdit()
  else if (key.name === 'd') remove()
})
</script>

<template>
  <Box flexDirection="column" :flexGrow="1" backgroundColor="#101419">
    <Box flexDirection="row" justifyContent="space-between" backgroundColor="#202830" :paddingX="1">
      <Text bold fg="#42b883">VUEBOARD</Text>
      <Text fg="#c9d1d9">Terminal product board</Text>
      <Text fg="#7f8a96"
        >{{ columns.reduce((count, column) => count + column.cards.length, 0) }} cards</Text
      >
    </Box>

    <Box flexDirection="row" :flexGrow="1" :gap="1" :padding="1" overflow="hidden">
      <Box
        v-for="(column, columnIndex) in columns"
        :key="column.title"
        flexDirection="column"
        :width="'25%'"
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
        overflow="hidden"
        @mouse-over="(event) => dragOverColumn(columnIndex, event)"
        @mouse-drop="(event) => dropCard(columnIndex, column.cards.length, event)"
      >
        <Box
          v-for="(card, cardIndex) in column.cards"
          :key="card.id"
          flexDirection="column"
          :height="5"
          :flexShrink="0"
          :border="true"
          borderStyle="rounded"
          :borderColor="
            draggedCard?.cardId === card.id
              ? '#ffffff'
              : dropColumn === columnIndex && dropIndex === cardIndex
                ? '#ffffff'
                : activeColumn === columnIndex && selections[columnIndex] === cardIndex
                  ? column.color
                  : '#46505a'
          "
          :backgroundColor="
            draggedCard?.cardId === card.id
              ? '#33414d'
              : activeColumn === columnIndex && selections[columnIndex] === cardIndex
                ? '#26323b'
                : '#171c22'
          "
          :paddingX="1"
          :marginBottom="1"
          overflow="hidden"
          @mouse-down="(event) => startDrag(columnIndex, cardIndex, event)"
          @mouse-up="finishDrag"
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
          <Text :fg="priorityColor(card.priority)" :selectable="false"
            >{{ card.priority.toUpperCase() }} · {{ card.tag }}</Text
          >
        </Box>
        <Text v-if="!column.cards.length" fg="#7f8a96">No cards</Text>
      </Box>
    </Box>

    <Box flexDirection="row" justifyContent="space-between" backgroundColor="#202830" :paddingX="1">
      <Text fg="#d6dde5"
        >drag cards · ←→/hl column · ↑↓/jk card · m move · a add · e edit · d delete</Text
      >
      <Text fg="#7f8a96">{{ width }} cols · q quit</Text>
    </Box>

    <Box
      v-if="modal"
      position="absolute"
      top="30%"
      left="20%"
      width="60%"
      :height="8"
      :zIndex="10"
      flexDirection="column"
      :border="true"
      borderStyle="double"
      borderColor="#42b883"
      backgroundColor="#171c22"
      :padding="1"
      :title="modal === 'add' ? ' Add card ' : ' Edit card '"
    >
      <Input v-model="draft" width="100%" placeholder="Card title" autofocus @enter="save" />
      <Text fg="#7f8a96">enter save · esc cancel</Text>
    </Box>
  </Box>
</template>
