import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { favoritesRouter } from './routes/favorites.js'
import { progressRouter } from './routes/progress.js'
import { mangadexRouter } from './routes/mangadex.js'

const app = express()

// CORS_ORIGIN может быть несколько адресов через запятую (например,
// прод-домен на Vercel + его собственные preview-деплои) — на локальной
// разработке по умолчанию только Vite dev-сервер.
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/progress', progressRouter)
app.use('/api/mangadex', mangadexRouter)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

const port = Number(process.env.PORT ?? 4000)
app.listen(port, () => {
  console.log(`MangaRed API запущен на http://localhost:${port}`)
})
