<script setup lang="ts">
import { Box, computed, type Dimension } from 'vue-termui'

const props = defineProps<{
  title: string
  active?: boolean
  height?: Dimension
  width?: Dimension
}>()

const size = computed(() => ({
  ...(props.height === undefined ? {} : { height: props.height }),
  ...(props.width === undefined ? {} : { width: props.width }),
}))
</script>

<template>
  <Box
    v-bind="size"
    flexDirection="column"
    :border="true"
    borderStyle="rounded"
    :borderColor="active ? '#42b883' : '#46505a'"
    :title="` ${title} `"
    :titleColor="active ? '#7ee2a8' : '#9aa4af'"
    :paddingX="1"
    overflow="hidden"
  >
    <slot />
  </Box>
</template>
