import { Router } from 'express'
import { z } from 'zod'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const credentialsSchema = z.object({
  name: z.string().trim().min(2, 'Имя должно быть не короче 2 символов'),
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

function publicUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name }
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

  const user = await prisma.user.findUnique({ where: { email } })
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
  res.json({ token, user: publicUser(user) })
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
  let user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } })
    }
  } else {
    user = await prisma.user.create({ data: { email, name, googleId: payload.sub } })
  }

  const token = signToken({ userId: user.id })
  res.json({ token, user: publicUser(user) })
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' })
    return
  }
  res.json(publicUser(user))
})
