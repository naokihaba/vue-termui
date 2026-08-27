# Cookbook

Use these additional patterns after the primary skill guidance. Import Vue reactivity from `vue-termui` so the app and renderer share one runtime.

## Selection

```vue
<script setup lang="ts">
import { ref, Select } from 'vue-termui'

const index = ref(0)
const options = [
  { name: 'Development', value: 'dev' },
  { name: 'Production', value: 'prod' },
]
</script>

<template>
  <Select v-model="index" :options="options" @select="(option) => useMode(option?.value)" />
</template>
```

The model is the highlighted index. Read `options[index]` when the highlighted option is needed.

## Scrolling log

```vue
<ScrollBox :height="12" stickyScroll stickyStart="bottom">
  <Text v-for="(line, index) in lines" :key="index">{{ line }}</Text>
</ScrollBox>
```

The height creates the viewport. Keep `scrollX` and `scrollY` stable or change a `:key` to remount.

## Inline styled text

```vue
<script setup lang="ts">
import { bold, fg, t, Text } from 'vue-termui'

const status = t`${bold(fg('#42b883')('ready'))} for input`
</script>

<template>
  <Text :content="status" />
</template>
```

Use styled-text helpers instead of nesting `Text` components.

## Reset a textarea

```vue
<Textarea :key="editorKey" v-model="draft" :height="8" @submit="save" />
```

Increment `editorKey` after saving or loading a different document. The model only seeds a textarea when it mounts.

## Responsive image

```vue
<Box :height="16" width="100%">
  <Image :source="cover" width="100%" height="100%" fit="fit" @error="onError" />
</Box>
```

An image has no intrinsic terminal size. Always provide dimensions or let flex layout stretch it.

## Responsive progress bar

`ProgressBar.width` accepts a numeric terminal-cell count, not percentages. Use
the reactive terminal width to derive it:

```vue
<script setup lang="ts">
import { computed, ProgressBar, useTerminalSize } from 'vue-termui'

const { width } = useTerminalSize()
const barWidth = computed(() => Math.max(12, Math.min(40, width.value - 10)))
</script>

<template>
  <ProgressBar :value="progress" :max="100" :width="barWidth" />
</template>
```

## Safe filesystem browser

Default examples to read-only behavior. Resolve paths below an explicit root,
decide whether symlinks are followed (prefer not following them unless paths are
checked with `realpath`), cap preview byte counts, and handle permission or
disappearance errors without tearing down the app.

## Standalone workspace example

Give each app its own `package.json`, `tsconfig.json`, `vite.config.ts`,
`src/main.ts`, and README. Add the directory pattern to `pnpm-workspace.yaml`
and update `pnpm-lock.yaml`. Use a distinct private package name so it can run
with `pnpm --filter <name> dev`.
