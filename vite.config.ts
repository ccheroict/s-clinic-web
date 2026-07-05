import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaConfig } from './src/infra/pwaConfig'

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    VitePWA(pwaConfig as any)
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  test: {
    exclude: ['node_modules', 'e2e/**'],
  }
})