import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

export const progressRouter = Router()

progressRouter.use(requireAuth)

progressRouter.get('/', async (req, res) => {
  const progress = await prisma.readingProgress.findMany({
    where: { userId: req.userId },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(
    progress.map((p) => ({
      mangaId: p.mangaId,
      chapterId: p.chapterId,
      chapterNumber: p.chapterNumber,
      pageNumber: p.pageNumber,
      updatedAt: p.updatedAt,
    })),
  )
})

const upsertProgressSchema = z.object({
  mangaId: z.string().min(1),
  chapterId: z.string().min(1),
  chapterNumber: z.number(),
  pageNumber: z.number().int().min(0),
})

progressRouter.put('/', async (req, res) => {
  const parsed = upsertProgressSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }
  const { mangaId, chapterId, chapterNumber, pageNumber } = parsed.data

  const saved = await prisma.readingProgress.upsert({
    where: { userId_mangaId: { userId: req.userId!, mangaId } },
    create: { userId: req.userId!, mangaId, chapterId, chapterNumber, pageNumber },
    update: { chapterId, chapterNumber, pageNumber },
  })
  res.json({
    mangaId: saved.mangaId,
    chapterId: saved.chapterId,
    chapterNumber: saved.chapterNumber,
    pageNumber: saved.pageNumber,
    updatedAt: saved.updatedAt,
  })
})

progressRouter.delete('/', async (req, res) => {
  await prisma.readingProgress.deleteMany({ where: { userId: req.userId } })
  res.json({ ok: true })
})

progressRouter.delete('/:mangaId', async (req, res) => {
  await prisma.readingProgress
    .delete({ where: { userId_mangaId: { userId: req.userId!, mangaId: req.params.mangaId } } })
    .catch(() => false) // уже удалено/не было — не считаем ошибкой
  res.json({ ok: true })
})
