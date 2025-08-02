import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/electric-chair-game/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      // analysis-resultsをpublicAssetとして扱う
      input: {
        main: resolve(__dirname, 'index.html'),
      }
    }
  },
  // analysis-resultsディレクトリをコピー
  publicDir: 'public',
  assetsInclude: ['**/*.json']
})