import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const useHttps = process.env.npm_lifecycle_event === 'dev:https'

export default defineConfig({
  base: './',
  plugins: useHttps ? [basicSsl()] : [],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
