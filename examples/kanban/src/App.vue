<script setup lang="ts">
import { Box, Text, useTitle } from 'vue-termui'
import { RouterView } from 'vue-router'

useTitle('VueBoard')
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
      <Text bold fg="#42b883">VUEBOARD</Text>
      <Text fg="#c9d1d9">GitHub Projects in your terminal</Text>
      <Text fg="#7f8a96">Ctrl+C exit</Text>
    </Box>
    <RouterView />
  </Box>
</template>
