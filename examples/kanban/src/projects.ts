import { ref } from 'vue-termui'
import { loadProjects, saveProjects, type ConnectedProject } from './config'

export const connectedProjects = ref<ConnectedProject[]>(loadProjects())

export function storeProjects(projects: ConnectedProject[]): void {
  connectedProjects.value = projects
  saveProjects(projects)
}
