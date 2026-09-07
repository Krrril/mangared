import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { authRouter } from './routes/auth.js'
import { favoritesRouter } from './routes/favorites.js'
import { progressRouter } from './routes/progress.js'
import { mangadexRouter } from './routes/mangadex.js'
import { adminRouter } from './routes/admin.js'
import { uploadRouter } from './routes/upload.js'
import { originalsRouter } from './routes/originals.js'
import { statsRouter } from './routes/stats.js'
import { notificationsRouter } from './routes/notifications.js'

const app = express()

// Render (как и большинство PaaS) кладёт приложение за собственным reverse
// proxy — без этой настройки req.ip всегда возвращал бы внутренний IP
// прокси Render, один и тот же для всех посетителей, а не реальный IP
// клиента из X-Forwarded-For. Важно для geoip в /api/stats/visit (см.
// routes/stats.ts) и заодно для точности уже существующих Turnstile-
// проверки (routes/auth.ts) и express-rate-limit по IP.
app.set('trust proxy', true)

// CORS_ORIGIN может быть несколько адресов через запятую (например,
// прод-домен на Vercel + его собственные preview-деплои) — на локальной
// разработке по умолчанию только Vite dev-сервер.
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// credentials: true — нужно, чтобы браузер вообще посылал/принимал наши
// httpOnly-куки (visit_id, is_owner, см. routes/stats.ts) на кросс-доменные
// запросы к API (фронтенд на mangagreen.com/vercel.app, бэкенд на
// onrender.com — разные origin). Без этого Set-Cookie от API браузер
// тихо игнорирует. Работает только с explicit origin-списком (не "*"),
// он у нас и так уже такой — см. allowedOrigins выше.
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/progress', progressRouter)
app.use('/api/mangadex', mangadexRouter)
app.use('/api/admin', adminRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/originals', originalsRouter)
app.use('/api/stats', statsRouter)
app.use('/api/notifications', notificationsRouter)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

const port = Number(process.env.PORT ?? 4000)
app.listen(port, () => {
  console.log(`MangaGreen API запущен на http://localhost:${port}`)
})
