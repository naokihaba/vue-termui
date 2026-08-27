import { env } from 'node:process'
import type { ConnectedProject } from './config'

const API_URL = 'https://api.github.com/graphql'

export interface ProjectColumn {
  id: string | null
  title: string
  color: string
  cards: ProjectCard[]
}

export interface ProjectCard {
  assignees: string[]
  author: string | null
  body: string
  contentId: string | null
  contentType: 'DraftIssue' | 'Issue' | 'PullRequest' | 'Redacted'
  id: string
  labels: string[]
  number: number | null
  repository: string | null
  state: string | null
  subtitle: string
  title: string
  url: string | null
}

export interface GitHubProject {
  id: string
  title: string
  url: string
  statusFieldId: string | null
  columns: ProjectColumn[]
}

interface GraphQLError {
  message: string
}

interface GraphQLResponse<T> {
  data?: T
  errors?: GraphQLError[]
}

interface ProjectNode {
  id: string
  title: string
  url: string
  fields: {
    nodes: Array<{
      id: string
      name: string
      options?: Array<{ id: string; name: string; color: string }>
    } | null>
  }
  items: {
    nodes: Array<{
      id: string
      fieldValues: {
        nodes: Array<{ field?: { id: string }; optionId?: string } | null>
      }
      content:
        | {
            __typename: 'DraftIssue'
            assignees: { nodes: Array<{ login: string } | null> }
            body: string
            creator: { login: string } | null
            id: string
            title: string
          }
        | {
            __typename: 'Issue' | 'PullRequest'
            assignees: { nodes: Array<{ login: string } | null> }
            author: { login: string } | null
            body: string
            id: string
            number: number
            state: string
            title: string
            url: string
            repository: { nameWithOwner: string }
            labels: { nodes: Array<{ name: string } | null> }
          }
        | null
    } | null>
  }
}

function token(): string {
  const value = env.GITHUB_TOKEN?.trim()
  if (!value) {
    throw new Error('Set GITHUB_TOKEN to a fine-grained personal access token first')
  }
  return value
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vue-termui-kanban',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ query, variables }),
  })

  const body = (await response.json()) as GraphQLResponse<T>
  if (!response.ok || body.errors?.length) {
    throw new Error(
      body.errors?.map(({ message }) => message).join('; ') || `GitHub returned ${response.status}`,
    )
  }
  if (!body.data) throw new Error('GitHub returned no data')
  return body.data
}

const projectFields = `
  id
  title
  url
  fields(first: 50) {
    nodes {
      ... on ProjectV2Field { id name }
      ... on ProjectV2IterationField { id name }
      ... on ProjectV2SingleSelectField { id name options { id name color } }
    }
  }
  items(first: 100) {
    nodes {
      id
      fieldValues(first: 20) {
        nodes {
          ... on ProjectV2ItemFieldSingleSelectValue { optionId field { ... on ProjectV2SingleSelectField { id } } }
        }
      }
      content {
        __typename
        ... on DraftIssue {
          id title body creator { login }
          assignees(first: 10) { nodes { login } }
        }
        ... on Issue {
          id number title body state url author { login }
          repository { nameWithOwner }
          assignees(first: 10) { nodes { login } }
          labels(first: 20) { nodes { name } }
        }
        ... on PullRequest {
          id number title body state url author { login }
          repository { nameWithOwner }
          assignees(first: 10) { nodes { login } }
          labels(first: 20) { nodes { name } }
        }
      }
    }
  }
`

const statusColors: Record<string, string> = {
  BLUE: '#61afef',
  GRAY: '#7f8a96',
  GREEN: '#42b883',
  ORANGE: '#d19a66',
  PINK: '#c678dd',
  PURPLE: '#a78bfa',
  RED: '#e06c75',
  YELLOW: '#e5c07b',
}

export async function fetchProject(project: ConnectedProject): Promise<GitHubProject> {
  const ownerField = project.ownerKind === 'orgs' ? 'organization' : 'user'
  const data = await graphql<Record<string, { projectV2: ProjectNode | null } | null>>(
    `query Project($owner: String!, $number: Int!) {
      ${ownerField}(login: $owner) { projectV2(number: $number) { ${projectFields} } }
    }`,
    { owner: project.owner, number: project.number },
  )
  const node = data[ownerField]?.projectV2
  if (!node) throw new Error('Project not found or the token cannot access it')

  const status = node.fields.nodes.find((field) => field?.name === 'Status' && field.options)
  const options = status?.options ?? []
  const columns: ProjectColumn[] = options.map((option) => ({
    id: option.id,
    title: option.name.toUpperCase(),
    color: statusColors[option.color] ?? '#7f8a96',
    cards: [],
  }))
  const noStatus: ProjectColumn = {
    id: null,
    title: 'NO STATUS',
    color: '#7f8a96',
    cards: [],
  }

  for (const item of node.items.nodes) {
    if (!item) continue
    const content = item.content
    const statusValue = item.fieldValues.nodes.find((value) => value?.field?.id === status?.id)
    const column = columns.find(({ id }) => id === statusValue?.optionId) ?? noStatus
    const linkedContent = content && content.__typename !== 'DraftIssue' ? content : null
    const repository = linkedContent?.repository.nameWithOwner ?? null
    const labels = linkedContent?.labels.nodes.flatMap((label) => (label ? [label.name] : [])) ?? []
    column.cards.push({
      id: item.id,
      assignees:
        content?.assignees.nodes.flatMap((assignee) => (assignee ? [assignee.login] : [])) ?? [],
      author: content
        ? content.__typename === 'DraftIssue'
          ? (content.creator?.login ?? null)
          : (content.author?.login ?? null)
        : null,
      body: content?.body ?? '',
      contentId: content?.id ?? null,
      contentType: content?.__typename ?? 'Redacted',
      labels,
      number: linkedContent?.number ?? null,
      repository,
      state: linkedContent?.state ?? null,
      title: content?.title ?? 'Redacted item',
      subtitle: labels[0] ? `${repository} · ${labels[0]}` : (repository ?? 'Draft'),
      url: linkedContent?.url ?? null,
    })
  }
  if (noStatus.cards.length || columns.length === 0) columns.unshift(noStatus)

  return {
    id: node.id,
    title: node.title,
    url: node.url,
    statusFieldId: status?.id ?? null,
    columns,
  }
}

export async function setCardStatus(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string | null,
): Promise<void> {
  if (optionId) {
    await graphql(
      `
        mutation SetStatus($project: ID!, $item: ID!, $field: ID!, $option: String!) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $project
              itemId: $item
              fieldId: $field
              value: { singleSelectOptionId: $option }
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `,
      { project: projectId, item: itemId, field: fieldId, option: optionId },
    )
  } else {
    await graphql(
      `
        mutation ClearStatus($project: ID!, $item: ID!, $field: ID!) {
          clearProjectV2ItemFieldValue(
            input: { projectId: $project, itemId: $item, fieldId: $field }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `,
      { project: projectId, item: itemId, field: fieldId },
    )
  }
}

export async function moveCardAfter(
  projectId: string,
  itemId: string,
  afterId: string | null,
): Promise<void> {
  await graphql(
    `
      mutation MoveItem($project: ID!, $item: ID!, $after: ID) {
        updateProjectV2ItemPosition(
          input: { projectId: $project, itemId: $item, afterId: $after }
        ) {
          clientMutationId
        }
      }
    `,
    { project: projectId, item: itemId, after: afterId },
  )
}

export async function createDraftCard(projectId: string, title: string): Promise<string> {
  const data = await graphql<{ addProjectV2DraftIssue: { projectV2Item: { id: string } } }>(
    `
      mutation AddDraft($project: ID!, $title: String!) {
        addProjectV2DraftIssue(input: { projectId: $project, title: $title }) {
          projectV2Item {
            id
          }
        }
      }
    `,
    { project: projectId, title },
  )
  return data.addProjectV2DraftIssue.projectV2Item.id
}

export async function updateCardTitle(card: ProjectCard, title: string): Promise<void> {
  if (!card.contentId || card.contentType === 'Redacted') {
    throw new Error('This item cannot be edited')
  }
  const mutation =
    card.contentType === 'DraftIssue'
      ? 'updateProjectV2DraftIssue'
      : card.contentType === 'Issue'
        ? 'updateIssue'
        : 'updatePullRequest'
  const idField = card.contentType === 'DraftIssue' ? 'draftIssueId' : 'id'
  await graphql(
    `mutation Rename($id: ID!, $title: String!) {
      ${mutation}(input: { ${idField}: $id, title: $title }) { clientMutationId }
    }`,
    { id: card.contentId, title },
  )
}

export async function updateCardBody(card: ProjectCard, body: string): Promise<void> {
  if (!card.contentId || card.contentType === 'Redacted') {
    throw new Error('This item cannot be edited')
  }
  const mutation =
    card.contentType === 'DraftIssue'
      ? 'updateProjectV2DraftIssue'
      : card.contentType === 'Issue'
        ? 'updateIssue'
        : 'updatePullRequest'
  const idField = card.contentType === 'DraftIssue' ? 'draftIssueId' : 'id'
  await graphql(
    `mutation UpdateBody($id: ID!, $body: String!) {
      ${mutation}(input: { ${idField}: $id, body: $body }) { clientMutationId }
    }`,
    { id: card.contentId, body },
  )
}

export async function removeCard(projectId: string, itemId: string): Promise<void> {
  await graphql(
    `
      mutation RemoveItem($project: ID!, $item: ID!) {
        deleteProjectV2Item(input: { projectId: $project, itemId: $item }) {
          deletedItemId
        }
      }
    `,
    { project: projectId, item: itemId },
  )
}
