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
import { commentsRouter } from './routes/comments.js'
import { reactionsRouter } from './routes/reactions.js'
import { premiumRouter } from './routes/premium.js'
import { profileRouter } from './routes/profile.js'
import rateLimit from 'express-rate-limit'
import { clientKey } from './utils/clientKey.js'

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

/*
  Базовая защита от перегрузки (скрейперы, накрутка, простой DoS): общий
  лимит на клиента для всего /api и отдельный, строже, для /stats/visit
  (туда по запросу на каждый переход бот не должен слать тысячи). Ключ —
  clientKey(): реальный IP из CF-Connecting-IP, а не подставляемый
  клиентом X-Forwarded-For. Лимиты щедрые для живого человека; при превышении —
  429 с Retry-After, данные не затрагиваются. Это ЗАЩИТА ПРИЛОЖЕНИЯ, а не
  сетевая: настоящий L3/L4-DDoS гасится Cloudflare/Render перед нами.
  Лимит бюджета запросов к MangaDex на клиента — отдельно, в
  services/mangadexClient.ts.
*/
const limiterOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  validate: { keyGeneratorIpFallback: false },
} as const
app.use(
  '/api',
  rateLimit({
    ...limiterOptions,
    windowMs: 60_000,
    limit: Number(process.env.API_RATE_LIMIT_PER_MIN ?? 600),
    message: { error: 'Слишком много запросов, попробуйте через минуту', code: 'rate_limited' },
  }),
)
app.use(
  '/api/stats/visit',
  rateLimit({
    ...limiterOptions,
    windowMs: 60_000,
    limit: Number(process.env.VISIT_RATE_LIMIT_PER_MIN ?? 120),
    // Для счётчика визитов ответ-ошибка бессмысленен — тихо отвечаем 204.
    handler: (_req, res) => {
      res.status(204).end()
    },
  }),
)

app.use('/api/auth', authRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/progress', progressRouter)
app.use('/api/mangadex', mangadexRouter)
app.use('/api/admin', adminRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/originals', originalsRouter)
app.use('/api/stats', statsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/reactions', reactionsRouter)
app.use('/api/premium', premiumRouter)
app.use('/api/profile', profileRouter)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

const port = Number(process.env.PORT ?? 4000)
app.listen(port, () => {
  console.log(`MangaGreen API запущен на http://localhost:${port}`)
})
