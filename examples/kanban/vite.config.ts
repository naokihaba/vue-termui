import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'
import vueTermui from 'vue-termui/vite'

export default defineConfig({
  plugins: [
    VueRouter({
      routesFolder: 'src/pages',
      importMode: 'sync',
      dts: 'typed-router.d.ts',
    }),
    vueTermui(),
  ],
})
