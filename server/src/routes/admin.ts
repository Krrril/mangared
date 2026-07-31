import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)

const querySchema = z.object({
  q: z.string().trim().optional(),
  sort: z.enum(['createdAt_desc', 'createdAt_asc']).optional().default('createdAt_desc'),
})

/*
  Список пользователей — только имя/email/дата регистрации/способ входа,
  без password_hash и прочих чувствительных полей. Поиск по email/имени
  (регистронезависимо), сортировка по дате регистрации.
*/
adminRouter.get('/users', async (req, res) => {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные параметры запроса' })
    return
  }
  const { q, sort } = parsed.data

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: sort === 'createdAt_asc' ? 'asc' : 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      passwordHash: true,
      googleId: true,
      isAdmin: true,
    },
  })

  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      isAdmin: u.isAdmin,
      loginMethod: u.googleId ? (u.passwordHash ? 'email+google' : 'google') : 'email',
    })),
  )
})
