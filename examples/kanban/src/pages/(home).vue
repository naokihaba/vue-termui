<script setup lang="ts">
import { Box, Input, onKeyDown, ref, Text } from 'vue-termui'
import { useRouter } from 'vue-router'
import { parseProjectUrl, projectId } from '../config'
import { fetchProject } from '../github'
import { connectedProjects, storeProjects } from '../projects'

const router = useRouter()
const selection = ref(0)
const adding = ref(false)
const projectUrl = ref('')
const busy = ref(false)
const message = ref('')
const error = ref('')

function select(index: number): void {
  selection.value = index
}

function moveSelection(step: number): void {
  if (!connectedProjects.value.length) return
  selection.value =
    (selection.value + step + connectedProjects.value.length) % connectedProjects.value.length
}

async function openProject(index = selection.value): Promise<void> {
  const project = connectedProjects.value[index]
  if (!project) return
  await router.push(`/projects/${project.id}`)
}

async function connect(): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  message.value = 'Checking project access…'
  try {
    const parsed = parseProjectUrl(projectUrl.value)
    const remote = await fetchProject({ ...parsed, id: '', title: '' })
    const id = projectId(parsed.ownerKind, parsed.owner, parsed.number)
    const project = { ...parsed, id, title: remote.title, url: remote.url }
    const projects = connectedProjects.value.filter((entry) => entry.id !== id)
    projects.push(project)
    storeProjects(projects)
    projectUrl.value = ''
    adding.value = false
    selection.value = projects.length - 1
    message.value = `Connected ${remote.title}`
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
    message.value = ''
  } finally {
    busy.value = false
  }
}

function removeSelected(): void {
  const project = connectedProjects.value[selection.value]
  if (!project) return
  const projects = connectedProjects.value.filter(({ id }) => id !== project.id)
  storeProjects(projects)
  selection.value = Math.max(0, Math.min(selection.value, projects.length - 1))
  message.value = `Disconnected ${project.title}`
}

onKeyDown((key) => {
  if (adding.value) {
    if (key.name === 'escape') {
      adding.value = false
      projectUrl.value = ''
      error.value = ''
    }
    return
  }
  if (key.name === 'up' || key.name === 'k') moveSelection(-1)
  else if (key.name === 'down' || key.name === 'j') moveSelection(1)
  else if (key.name === 'return') void openProject()
  else if (key.name === 'a') adding.value = true
  else if (key.name === 'd') removeSelected()
})
</script>

<template>
  <Box flexDirection="column" :flexGrow="1" :padding="2" :gap="1">
    <Text bold fg="#e7edf3">Connected GitHub Projects</Text>
    <Text fg="#7f8a96">Choose a board or connect another Projects v2 URL.</Text>

    <Box
      v-for="(project, index) in connectedProjects"
      :key="project.id"
      flexDirection="column"
      :border="true"
      borderStyle="rounded"
      :borderColor="selection === index ? '#42b883' : '#46505a'"
      :backgroundColor="selection === index ? '#26323b' : '#171c22'"
      :paddingX="1"
      @mouseDown.left="select(index)"
      @mouseUp.left="openProject(index)"
    >
      <Text :bold="selection === index" fg="#e7edf3">{{ project.title }}</Text>
      <Text fg="#7f8a96">{{ project.owner }} · project {{ project.number }}</Text>
    </Box>

    <Box
      v-if="!connectedProjects.length"
      :border="true"
      borderStyle="rounded"
      borderColor="#46505a"
      :padding="1"
    >
      <Text fg="#7f8a96">No projects connected. Press a to add one.</Text>
    </Box>

    <Box
      v-if="adding"
      flexDirection="column"
      :border="true"
      borderStyle="double"
      borderColor="#42b883"
      :padding="1"
      title=" Connect project "
    >
      <Input
        v-model="projectUrl"
        width="100%"
        placeholder="https://github.com/orgs/OWNER/projects/NUMBER"
        autofocus
        @enter="connect"
      />
      <Text fg="#7f8a96">enter connect · esc cancel</Text>
    </Box>

    <Text v-if="busy || message" fg="#61afef">{{ message }}</Text>
    <Text v-if="error" fg="#e06c75">{{ error }}</Text>

    <Box :flexGrow="1" />
    <Text fg="#7f8a96">↑↓/jk select · enter open · a connect · d disconnect</Text>
    <Text fg="#7f8a96">Authentication: export GITHUB_TOKEN with Projects read/write access.</Text>
  </Box>
</template>
