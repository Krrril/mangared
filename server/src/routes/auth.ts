import { Router } from 'express'
import { randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import { sendPasswordResetEmail } from '../services/email.js'

export const authRouter = Router()

// Тот же список источников, что и в CORS (index.ts) — первый служит базой
// для ссылки в письме сброса пароля (см. /forgot-password ниже).
const FRONTEND_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim()

const credentialsSchema = z.object({
  name: z.string().trim().min(2, 'Имя должно быть не короче 2 символов'),
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

function publicUser(
  user: { id: string; email: string; name: string; isAdmin?: boolean },
  authorUsername?: string | null,
) {
  return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin ?? false, authorUsername: authorUsername ?? null }
}

authRouter.post('/register', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }
  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' })
    return
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { name, email, passwordHash } })

  const token = signToken({ userId: user.id })
  res.status(201).json({ token, user: publicUser(user) })
})

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({
    where: { email },
    include: { authorProfile: { select: { username: true } } },
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
  res.json({ token, user: publicUser(user, user.authorProfile?.username) })
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
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { authorProfile: { select: { username: true } } },
  })
  let user
  let authorUsername: string | undefined
  if (existing) {
    user = existing.googleId ? existing : await prisma.user.update({ where: { id: existing.id }, data: { googleId: payload.sub } })
    authorUsername = existing.authorProfile?.username
  } else {
    user = await prisma.user.create({ data: { email, name, googleId: payload.sub } })
  }

  const token = signToken({ userId: user.id })
  res.json({ token, user: publicUser(user, authorUsername) })
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { authorProfile: { select: { username: true } } },
  })
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' })
    return
  }
  res.json(publicUser(user, user.authorProfile?.username))
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
  // у него пароль (Google-только аккаунты пропускаем молча) — не даём
  // угадать по ответу, какие email зарегистрированы на сайте.
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (user?.passwordHash) {
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
