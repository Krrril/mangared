import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Локальный аналог прокси обложек с Vercel (см. api/cover.ts): тот же путь
      // /covers/<uuid>/<файл>, честный User-Agent. Только для разработки.
      '/covers': {
        target: 'https://uploads.mangadex.org',
        changeOrigin: true,
        headers: { 'User-Agent': 'MangaGreen/1.0 (+https://www.mangagreen.com)' },
      },
    },
  },
})
