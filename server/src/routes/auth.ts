import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
})

authRouter.post('/register', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }
  const { email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' })
    return
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email, passwordHash } })

  const token = signToken({ userId: user.id })
  res.status(201).json({ token, user: { id: user.id, email: user.email } })
})

authRouter.post('/login', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false

  if (!user || !passwordOk) {
    // Намеренно один и тот же текст ошибки для "нет такого email" и
    // "неверный пароль" — не подсказываем злоумышленнику, какие email
    // зарегистрированы.
    res.status(401).json({ error: 'Неверный email или пароль' })
    return
  }

  const token = signToken({ userId: user.id })
  res.json({ token, user: { id: user.id, email: user.email } })
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' })
    return
  }
  res.json({ id: user.id, email: user.email, createdAt: user.createdAt })
})
