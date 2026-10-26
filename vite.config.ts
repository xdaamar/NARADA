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
      },
      '/api/rss/turnbackhoax': {
        target: 'https://turnbackhoax.id',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/feed/'
      },
      '/api/rss/google-news': {
        target: 'https://news.google.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/rss\/google-news/, '/rss')
      },
      '/api/rss/google-trends': {
        target: 'https://trends.google.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/trending/rss?geo=ID'
      }
    }
  }
})
