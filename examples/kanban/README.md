# VueBoard

A `vue-termui` client for GitHub Projects. It can connect multiple organization
or user Projects v2 boards and keeps status changes, ordering, draft items, and
title edits synchronized with GitHub.

## Authentication

The simplest setup is a fine-grained personal access token. Give it access to
the organizations/repositories whose projects you want to use and grant the
Projects permission read/write access. Editing linked issue and pull-request
titles also needs the matching Issues and Pull requests write permissions.
Then expose the token to the process:

```bash
export GITHUB_TOKEN=github_pat_...
```

The token is only read from the environment and is never saved. Connected
project URLs are stored in `$XDG_CONFIG_HOME/vue-termui/kanban.json` (normally
`~/.config/vue-termui/kanban.json`). Set `VUEBOARD_CONFIG` to use another file.

## Run

```bash
pnpm --filter @vue-termui/example-kanban dev
```

Press `a` on the project page and paste a URL such as
`https://github.com/orgs/vuejs/projects/1`. Both organization (`/orgs/`) and
user (`/users/`) project URLs are supported.

Drag cards with the mouse to reorder or change their Status. Move around with
arrows or `hjkl`, press `m` to move an item to the next status, `a` to add a
draft item, `e` to edit its GitHub title, `d` to remove it from the project,
`r` to refresh, and `b` to return to the connected-project list. Removing an
item does not delete its linked issue or pull request.

GitHub's GraphQL API returns the first 100 project items in this example.
