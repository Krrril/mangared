import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

export const notificationsRouter = Router()

notificationsRouter.use(requireAuth)

/**
 * actorId/mangaId в Notification — не foreign key (см. schema.prisma), так
 * что подтягиваем актёра/тайтл вручную, батчем по спискам id, а не через
 * include — и не падаем, если то, на что ссылается уведомление, уже удалено
 * (просто actor/manga придёт null, фронт покажет обобщённый текст).
 */
notificationsRouter.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const actorIds = [...new Set(notifications.map((n) => n.actorId).filter((id): id is string => !!id))]
  const mangaIds = [...new Set(notifications.map((n) => n.mangaId).filter((id): id is string => !!id))]

  const [actors, mangas] = await Promise.all([
    actorIds.length
      ? prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, authorProfile: { select: { username: true, displayName: true, avatarUrl: true } } },
        })
      : Promise.resolve([]),
    mangaIds.length ? prisma.userManga.findMany({ where: { id: { in: mangaIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
  ])

  const actorById = new Map(
    actors.map((a) => [
      a.id,
      { name: a.authorProfile?.displayName ?? a.name, avatarUrl: a.authorProfile?.avatarUrl ?? null, username: a.authorProfile?.username ?? null },
    ]),
  )
  const mangaById = new Map(mangas.map((m) => [m.id, { id: m.id, title: m.title }]))

  res.json(
    notifications.map((n) => ({
      id: n.id,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt,
      actor: n.actorId ? actorById.get(n.actorId) ?? null : null,
      manga: n.mangaId ? mangaById.get(n.mangaId) ?? null : null,
    })),
  )
})

notificationsRouter.get('/unread-count', async (req, res) => {
  const count = await prisma.notification.count({ where: { userId: req.userId, read: false } })
  res.json({ count })
})

notificationsRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } })
  res.json({ ok: true })
})
