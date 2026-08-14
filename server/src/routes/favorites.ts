import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

export const favoritesRouter = Router()

favoritesRouter.use(requireAuth)

favoritesRouter.get('/', async (req, res) => {
  const favorites = await prisma.favorite.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
  })
  res.json(favorites.map((f) => f.mangaId))
})

const addFavoriteSchema = z.object({ mangaId: z.string().min(1) })

favoritesRouter.post('/', async (req, res) => {
  const parsed = addFavoriteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Нужен mangaId' })
    return
  }
  const { mangaId } = parsed.data

  // "Лайк" тайтла — это и есть добавление в избранное (см.
  // TitleStats.favoritesCount в schema.prisma), отдельной сущности нет.
  // create вместо upsert — чтобы отличить "правда добавили" от "уже было
  // в избранном" и не задвоить счётчик при повторном клике.
  const added = await prisma.favorite
    .create({ data: { userId: req.userId!, mangaId } })
    .then(() => true)
    .catch(() => false)

  if (added) {
    await prisma.titleStats.upsert({
      where: { mangaId },
      create: { mangaId, favoritesCount: 1 },
      update: { favoritesCount: { increment: 1 } },
    })
  }

  res.status(201).json({ ok: true })
})

favoritesRouter.delete('/:mangaId', async (req, res) => {
  const deleted = await prisma.favorite
    .delete({
      where: { userId_mangaId: { userId: req.userId!, mangaId: req.params.mangaId } },
    })
    .then(() => true)
    .catch(() => false) // уже удалено/не было — не считаем ошибкой

  if (deleted) {
    // updateMany с условием favoritesCount > 0 — не даёт уйти в минус и,
    // в отличие от update, не падает, если строки TitleStats ещё нет.
    await prisma.titleStats.updateMany({
      where: { mangaId: req.params.mangaId, favoritesCount: { gt: 0 } },
      data: { favoritesCount: { decrement: 1 } },
    })
  }

  res.json({ ok: true })
})
