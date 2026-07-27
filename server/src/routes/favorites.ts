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

  await prisma.favorite.upsert({
    where: { userId_mangaId: { userId: req.userId!, mangaId: parsed.data.mangaId } },
    create: { userId: req.userId!, mangaId: parsed.data.mangaId },
    update: {},
  })
  res.status(201).json({ ok: true })
})

favoritesRouter.delete('/:mangaId', async (req, res) => {
  await prisma.favorite
    .delete({
      where: { userId_mangaId: { userId: req.userId!, mangaId: req.params.mangaId } },
    })
    .catch(() => null) // уже удалено/не было — не считаем ошибкой
  res.json({ ok: true })
})
