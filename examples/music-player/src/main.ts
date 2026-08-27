import { createApp } from 'vue-termui'
import App from './App.vue'
import { router } from './router'

const app = await createApp(App, null, { exitOnCtrlC: true, consoleMode: 'disabled' })
app.use(router)
await router.push(process.argv[2] || '/')
await router.isReady()
app.mount()
