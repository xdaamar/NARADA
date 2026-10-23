import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/turnbackhoax': {
        target: 'https://turnbackhoax.id/wp-json/wp/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/turnbackhoax/, '')
      }
    }
  }
})
