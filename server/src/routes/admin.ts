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

/*
  Модерация авторской манги ("Originals") — тайтлы со статусом pending
  не видны в общем каталоге (см. routes/originals.ts), сюда попадают
  только они. approve/reject — единственные переходы отсюда: pending
  не может стать draft обратно, автор при отклонении может исправить
  и отправить на повторную модерацию (rejected -> pending).
*/
adminRouter.get('/originals/pending', async (_req, res) => {
  const mangas = await prisma.userManga.findMany({
    where: { status: 'pending' },
    include: { author: true, _count: { select: { chapters: true } } },
    orderBy: { updatedAt: 'asc' },
  })

  res.json(
    mangas.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      coverUrl: m.coverUrl,
      genres: m.genres,
      contentType: m.contentType,
      chaptersCount: m._count.chapters,
      updatedAt: m.updatedAt,
      author: { username: m.author.username, displayName: m.author.displayName },
    })),
  )
})

async function findPendingManga(id: string) {
  return prisma.userManga.findFirst({ where: { id, status: 'pending' } })
}

adminRouter.post('/originals/:id/approve', async (req, res) => {
  const manga = await findPendingManga(req.params.id)
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден или уже не на модерации' })
    return
  }
  await prisma.userManga.update({ where: { id: manga.id }, data: { status: 'published' } })
  res.json({ ok: true })
})

adminRouter.post('/originals/:id/reject', async (req, res) => {
  const manga = await findPendingManga(req.params.id)
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден или уже не на модерации' })
    return
  }
  await prisma.userManga.update({ where: { id: manga.id }, data: { status: 'rejected' } })
  res.json({ ok: true })
})
