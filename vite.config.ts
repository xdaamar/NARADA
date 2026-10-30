import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleRadarFeedRequest, getGatewayHealthStatus } from './src/engine/transport/rss-gateway-handler.ts'

function radarGatewayPlugin(): Plugin {
  const middleware = (req: any, res: any, next: any) => {
    const rawUrl = req.url || '/'
    const parsed = new URL(rawUrl, 'http://localhost:5173')
    
    if (parsed.pathname === '/api/radar/gateway/health' || parsed.pathname === '/api/health') {
      const health = getGatewayHealthStatus()
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(health))
      return
    }

    const match = parsed.pathname.match(/^\/api\/radar\/feed\/([a-zA-Z0-9_-]+)$/)
    if (match) {
      const sourceId = match[1]
      const queryParams: Record<string, string> = {}
      parsed.searchParams.forEach((v, k) => { queryParams[k] = v })

      handleRadarFeedRequest(sourceId, queryParams)
        .then(result => {
          for (const [k, v] of Object.entries(result.headers)) {
            res.setHeader(k, v)
          }
          res.statusCode = result.statusCode
          res.end(result.body)
        })
        .catch(err => {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, message: err?.message || 'Gateway error' }))
        })
      return
    }

    next()
  }

  return {
    name: 'radar-rss-gateway',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    }
  }
}

export default defineConfig({
  plugins: [react(), radarGatewayPlugin()],
  base: './',
  build: {
    outDir: 'dist',
  },
  preview: {
    port: 4173
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
      },
      '/api/osint/youtube': {
        target: 'https://www.youtube.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/osint\/youtube/, '')
      }
    }
  }
})
