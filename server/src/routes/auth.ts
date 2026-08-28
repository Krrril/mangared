import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import { sendPasswordResetEmail } from '../services/email.js'
import { ensureUniqueUsername } from './originals.js'
import { isTurnstileConfigured, verifyTurnstileToken } from '../utils/turnstile.js'
import { signOauthState, verifyOauthState } from '../utils/oauthState.js'

export const authRouter = Router()

// Тот же список источников, что и в CORS (index.ts) — первый служит базой
// для ссылки в письме сброса пароля и для redirect после входа через
// Яндекс (см. /forgot-password и /yandex/callback ниже).
const FRONTEND_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim()

// "Обычный" куст аккаунтов — пароль и/или Google, друг с другом сливаются
// по email (см. POST /google). Яндекс-аккаунты в этот куст не входят
// (см. коммент у User.email в schema.prisma) — при поиске/проверке email
// внутри этого куста Яндекс-only записи нужно явно исключать этим фильтром.
const REGULAR_ACCOUNT_FILTER: Prisma.UserWhereInput = { OR: [{ passwordHash: { not: null } }, { googleId: { not: null } }] }

// 10 попыток / 15 минут с IP — регистрация теперь ещё и за Turnstile (см.
// ниже), но лимит всё равно нужен как второй, независимый барьер: если
// Cloudflare Turnstile временно не настроен (isTurnstileConfigured() ===
// false) или сам недоступен, регистрация не должна остаться вообще без
// защиты от перебора.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток регистрации, попробуйте позже' },
})

// 20 попыток / 15 минут с IP — вход не защищён капчей (см. задачу — на
// форме входа Turnstile сочли неоправданным), поэтому лимит здесь чуть
// мягче, чем на регистрации, но всё же ограничивает перебор пароля.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа, попробуйте позже' },
})

const credentialsSchema = z.object({
  name: z.string().trim().min(2, 'Имя должно быть не короче 2 символов'),
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Юзернейм должен быть не короче 3 символов')
    .max(24, 'Юзернейм должен быть не длиннее 24 символов')
    .regex(/^[a-z0-9_]+$/, 'Юзернейм может содержать только латинские буквы, цифры и подчёркивание'),
  // Опционально в схеме — фактическая обязательность включается на
  // сервере через isTurnstileConfigured() (см. handler), не здесь: пока
  // TURNSTILE_SECRET_KEY не задан, поле может вообще не прийти.
  turnstileToken: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

function publicUser(
  user: { id: string; email: string; name: string; isAdmin?: boolean },
  authorUsername?: string | null,
  avatarUrl?: string | null,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin ?? false,
    authorUsername: authorUsername ?? null,
    avatarUrl: avatarUrl ?? null,
  }
}

authRouter.post('/register', registerLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }
  const { name, email, password, username, turnstileToken } = parsed.data

  if (isTurnstileConfigured()) {
    const turnstileOk = turnstileToken ? await verifyTurnstileToken(turnstileToken, req.ip) : false
    if (!turnstileOk) {
      res.status(400).json({ error: 'Не удалось подтвердить, что вы не робот. Обновите страницу и попробуйте снова.' })
      return
    }
  }

  const existingEmail = await prisma.user.findFirst({ where: { email, ...REGULAR_ACCOUNT_FILTER } })
  if (existingEmail) {
    res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' })
    return
  }

  const existingUsername = await prisma.authorProfile.findUnique({ where: { username } })
  if (existingUsername) {
    res.status(409).json({ error: 'Этот юзернейм уже занят, выберите другой' })
    return
  }

  const passwordHash = await hashPassword(password)
  // Каждый зарегистрированный пользователь сразу получает AuthorProfile с
  // выбранным юзернеймом (не только тот, кто опубликовал работу, как было
  // раньше, см. getOrCreateAuthorProfile в routes/originals.ts) — иначе
  // обычного читателя нельзя найти по юзернейму (см. пункт 8 задачи).
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name, email, passwordHash } })
    await tx.authorProfile.create({ data: { userId: created.id, username, displayName: name } })
    return created
  })

  const token = signToken({ userId: user.id })
  res.status(201).json({ token, user: publicUser(user, username) })
})

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }
  const { email, password } = parsed.data

  // findFirst, не findUnique — email больше не уникален глобально (см.
  // schema.prisma), только среди этого "обычного" куста аккаунтов.
  const user = await prisma.user.findFirst({
    where: { email, passwordHash: { not: null } },
    include: { authorProfile: { select: { username: true, avatarUrl: true } } },
  })
  // У пользователей, вошедших только через Google, passwordHash пустой —
  // verifyPassword с ним даже не вызываем, чтобы не звать bcrypt зря
  const passwordOk = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false

  if (!user || !passwordOk) {
    // Намеренно один и тот же текст ошибки для "нет такого email",
    // "неверный пароль" и "аккаунт без пароля (только Google)" — не
    // подсказываем злоумышленнику детали чужого аккаунта.
    res.status(401).json({ error: 'Неверный email или пароль' })
    return
  }

  const token = signToken({ userId: user.id })
  res.json({ token, user: publicUser(user, user.authorProfile?.username, user.authorProfile?.avatarUrl) })
})

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

const googleSchema = z.object({ credential: z.string().min(1) })

authRouter.post('/google', async (req, res) => {
  if (!googleClient) {
    res.status(501).json({ error: 'Вход через Google не настроен на сервере (нет GOOGLE_CLIENT_ID)' })
    return
  }

  const parsed = googleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Нужен credential' })
    return
  }

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: GOOGLE_CLIENT_ID,
    })
    payload = ticket.getPayload()
  } catch {
    res.status(401).json({ error: 'Не удалось проверить токен Google' })
    return
  }

  if (!payload?.email) {
    res.status(401).json({ error: 'Google не вернул email' })
    return
  }

  const email = payload.email.toLowerCase()
  const name = payload.name ?? email.split('@')[0]

  // Тот же email мог уже быть зарегистрирован через пароль — тогда просто
  // привязываем google_id к существующему аккаунту, не плодим дубликат.
  // findFirst со scope на "обычный" куст — см. REGULAR_ACCOUNT_FILTER:
  // Яндекс-аккаунт с тем же email (если есть) сюда попасть не должен, у
  // него своя, намеренно не связанная с этим email-веткой запись.
  const existing = await prisma.user.findFirst({
    where: { email, ...REGULAR_ACCOUNT_FILTER },
    include: { authorProfile: { select: { username: true, avatarUrl: true } } },
  })
  let user
  let authorUsername: string | undefined
  let avatarUrl: string | null | undefined
  if (existing) {
    user = existing.googleId ? existing : await prisma.user.update({ where: { id: existing.id }, data: { googleId: payload.sub } })
    authorUsername = existing.authorProfile?.username
    avatarUrl = existing.authorProfile?.avatarUrl
  } else {
    // Через Google юзернейм не выбирают вручную (нет формы) — генерируем
    // сразу, как и при обычной регистрации получают выбранный вручную (см.
    // POST /register выше), чтобы у любого пользователя он был с первого дня.
    user = await prisma.user.create({ data: { email, name, googleId: payload.sub } })
    authorUsername = await ensureUniqueUsername(name)
    await prisma.authorProfile.create({ data: { userId: user.id, username: authorUsername, displayName: name } })
  }

  const token = signToken({ userId: user.id })
  res.json({ token, user: publicUser(user, authorUsername, avatarUrl) })
})

/*
  Вход через Яндекс — classic OAuth2 authorization-code redirect (не
  popup/ID-токен, как у Google): у Яндекса нет аналога Google Identity
  Services, который отдавал бы подписанный credential прямо в JS без
  захода на сторону провайдера. Флоу:
    1) браузер переходит на GET /yandex/start (полная навигация, не fetch)
    2) start редиректит на oauth.yandex.ru/authorize с подписанным state
    3) Яндекс после согласия редиректит на GET /yandex/callback?code=...
    4) callback меняет code на access_token, достаёт email/имя, заводит
       или находит аккаунт, выдаёт наш JWT и редиректит на фронтенд
  См. также решение сессии: Яндекс-аккаунт НИКОГДА не сливается по email
  с обычным/Google-аккаунтом — всегда отдельная запись (см. комментарий
  у User.email в schema.prisma и REGULAR_ACCOUNT_FILTER выше).
*/
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET
const yandexConfigured = !!YANDEX_CLIENT_ID && !!YANDEX_CLIENT_SECRET
// Тот же backend-адрес, на который Яндекс должен слать code — см.
// YANDEX_REDIRECT_URI в .env.example и инструкцию в отчёте сессии для
// панели oauth.yandex.ru. Обязательно backend (Render), не фронтенд —
// обмен code на токен требует client_secret, а он не может уйти в браузер.
const YANDEX_REDIRECT_URI = process.env.YANDEX_REDIRECT_URI ?? 'http://localhost:4000/api/auth/yandex/callback'

authRouter.get('/yandex/start', (_req, res) => {
  if (!yandexConfigured) {
    res.redirect(`${FRONTEND_ORIGIN}/auth?error=yandex_not_configured`)
    return
  }
  const url = new URL('https://oauth.yandex.ru/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', YANDEX_CLIENT_ID!)
  url.searchParams.set('redirect_uri', YANDEX_REDIRECT_URI)
  url.searchParams.set('scope', 'login:email login:info')
  url.searchParams.set('state', signOauthState('yandex'))
  res.redirect(url.toString())
})

interface YandexTokenResponse {
  access_token?: string
  error?: string
}

interface YandexUserInfo {
  id: string
  login?: string
  default_email?: string
  emails?: string[]
  display_name?: string
  real_name?: string
}

authRouter.get('/yandex/callback', async (req, res) => {
  if (!yandexConfigured) {
    res.redirect(`${FRONTEND_ORIGIN}/auth?error=yandex_not_configured`)
    return
  }

  const code = req.query.code
  const state = req.query.state
  if (typeof code !== 'string' || typeof state !== 'string' || !verifyOauthState(state, 'yandex')) {
    res.redirect(`${FRONTEND_ORIGIN}/auth?error=yandex_state`)
    return
  }

  let accessToken: string
  try {
    const tokenRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: YANDEX_CLIENT_ID!,
        client_secret: YANDEX_CLIENT_SECRET!,
      }),
    })
    const tokenData = (await tokenRes.json()) as YandexTokenResponse
    if (!tokenData.access_token) throw new Error(tokenData.error ?? 'no access_token')
    accessToken = tokenData.access_token
  } catch (err) {
    console.error('Yandex token exchange failed:', err)
    res.redirect(`${FRONTEND_ORIGIN}/auth?error=yandex_token`)
    return
  }

  let info: YandexUserInfo
  try {
    const infoRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` },
    })
    if (!infoRes.ok) throw new Error(`status ${infoRes.status}`)
    info = (await infoRes.json()) as YandexUserInfo
  } catch (err) {
    console.error('Yandex user info fetch failed:', err)
    res.redirect(`${FRONTEND_ORIGIN}/auth?error=yandex_info`)
    return
  }

  const yandexId = String(info.id)
  const email = (info.default_email ?? info.emails?.[0] ?? `${yandexId}@yandex-noemail.invalid`).toLowerCase()
  const name = info.display_name || info.real_name || info.login || 'Yandex User'

  let user = await prisma.user.findUnique({ where: { yandexId } })
  if (!user) {
    // Всегда новый аккаунт, даже если email совпадает с уже
    // существующим обычным/Google-аккаунтом — см. решение сессии выше.
    user = await prisma.user.create({ data: { email, name, yandexId } })
    const authorUsername = await ensureUniqueUsername(name)
    await prisma.authorProfile.create({ data: { userId: user.id, username: authorUsername, displayName: name } })
  }

  const token = signToken({ userId: user.id })
  res.redirect(`${FRONTEND_ORIGIN}/auth/yandex/complete?token=${token}`)
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { authorProfile: { select: { username: true, avatarUrl: true } } },
  })
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' })
    return
  }
  res.json(publicUser(user, user.authorProfile?.username, user.authorProfile?.avatarUrl))
})

// 5 запросов / 15 минут с IP — письма стоят репутации отправителя и
// (в теории) денег, поэтому этот конкретный эндпоинт защищён отдельно от
// остальных, независимо от общей DDoS-защиты (см. ROADMAP.md — она пока
// отложена, но рассылку спама почтой в любом случае не стоило открывать).
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток, попробуйте позже' },
})

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 час

const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() })

authRouter.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректный email' })
    return
  }

  // Один и тот же ответ независимо от того, существует ли email и есть ли
  // у него пароль (Google/Яндекс-только аккаунты пропускаем молча) — не
  // даём угадать по ответу, какие email зарегистрированы на сайте.
  // findFirst с фильтром прямо в запросе — эквивалент прежнего
  // findUnique + `if (user?.passwordHash)`, но email больше не уникален
  // глобально (см. schema.prisma), findUnique по нему больше не годится.
  const user = await prisma.user.findFirst({ where: { email: parsed.data.email, passwordHash: { not: null } } })
  if (user) {
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    })
    const resetUrl = `${FRONTEND_ORIGIN}/reset-password?token=${rawToken}`
    sendPasswordResetEmail(user.email, resetUrl).catch((err) => console.error('sendPasswordResetEmail failed:', err))
  }

  res.json({ ok: true })
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
})

authRouter.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }

  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!resetToken || resetToken.expiresAt < new Date()) {
    res.status(400).json({ error: 'Ссылка недействительна или устарела' })
    return
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    // Остальные ранее выданные токены этого пользователя тоже гасим —
    // одна успешная смена пароля инвалидирует все письма до неё.
    prisma.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } }),
  ])

  res.json({ ok: true })
})
