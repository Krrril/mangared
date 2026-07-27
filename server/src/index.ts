import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { favoritesRouter } from './routes/favorites.js'
import { progressRouter } from './routes/progress.js'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/progress', progressRouter)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

const port = Number(process.env.PORT ?? 4000)
app.listen(port, () => {
  console.log(`MangaRed API запущен на http://localhost:${port}`)
})
