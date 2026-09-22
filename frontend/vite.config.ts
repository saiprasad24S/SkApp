import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'apk-headers-middleware',
      configureServer(server) {
        const handler = (req: any, res: any, next: any) => {
          const rawUrl = req.url || ''
          const url = rawUrl.split('?')[0]
          if (url.endsWith('.apk')) {
            const filename = path.basename(url)
            const apkPath = path.resolve(__dirname, 'public', filename)
            if (fs.existsSync(apkPath)) {
              const stat = fs.statSync(apkPath)
              res.setHeader('Content-Type', 'application/vnd.android.package-archive')
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
              res.setHeader('Content-Length', stat.size)
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
              res.setHeader('Pragma', 'no-cache')
              res.setHeader('Expires', '0')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.setHeader('X-Content-Type-Options', 'nosniff')
              if (req.method === 'HEAD') {
                res.statusCode = 200
                res.end()
                return
              }
              res.statusCode = 200
              const stream = fs.createReadStream(apkPath)
              stream.pipe(res)
              return
            }
          }
          next()
        }
        ;(server.middlewares as any).stack.unshift({ route: '', handle: handler })
      },
    },
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})

