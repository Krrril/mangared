import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'

export const reactionsRouter = Router()

/*
  Лайк/дизлайк тайтла целиком или отдельной главы — один голос на объект
  на пользователя, может сменить или снять (см. schema.prisma, Reaction).
  chapterId в запросах — пустая строка или отсутствует означают "реакция
  на тайтл целиком"; на бэкенде всегда нормализуем в '' (не null — см.
  комментарий у Reaction.chapterId в схеме, почему).
*/

// Реакции — более лёгкое действие, чем комментарий (обычный клик по
// сердечку/пальцу), лимит мягче, чем у комментариев, но всё ещё защищает
// от скриптового спама голосами.
const reactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов, подождите немного' },
})

const getQuerySchema = z.object({
  mangaId: z.string().min(1),
  chapterId: z.string().min(1).optional(),
})

reactionsRouter.get('/', optionalAuth, async (req, res) => {
  const parsed = getQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные параметры запроса' })
    return
  }
  const { mangaId } = parsed.data
  const chapterId = parsed.data.chapterId ?? ''

  const [likes, dislikes, mine] = await Promise.all([
    prisma.reaction.count({ where: { mangaId, chapterId, type: 'like' } }),
    prisma.reaction.count({ where: { mangaId, chapterId, type: 'dislike' } }),
    req.userId
      ? prisma.reaction.findUnique({ where: { userId_mangaId_chapterId: { userId: req.userId, mangaId, chapterId } } })
      : Promise.resolve(null),
  ])

  res.json({ likes, dislikes, myReaction: mine?.type ?? null })
})

const setReactionSchema = z.object({
  mangaId: z.string().min(1),
  chapterId: z.string().min(1).optional(),
  type: z.enum(['like', 'dislike']),
})

/** Ставит реакцию; повторный тот же тип — снимает голос; другой тип — меняет (см. задачу). */
reactionsRouter.post('/', requireAuth, reactionLimiter, async (req, res) => {
  const parsed = setReactionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные данные' })
    return
  }
  const { mangaId, type } = parsed.data
  const chapterId = parsed.data.chapterId ?? ''

  const existing = await prisma.reaction.findUnique({
    where: { userId_mangaId_chapterId: { userId: req.userId!, mangaId, chapterId } },
  })

  let myReaction: 'like' | 'dislike' | null
  if (existing && existing.type === type) {
    await prisma.reaction.delete({ where: { id: existing.id } })
    myReaction = null
  } else if (existing) {
    await prisma.reaction.update({ where: { id: existing.id }, data: { type } })
    myReaction = type
  } else {
    await prisma.reaction.create({ data: { userId: req.userId!, mangaId, chapterId, type } })
    myReaction = type
  }

  const [likes, dislikes] = await Promise.all([
    prisma.reaction.count({ where: { mangaId, chapterId, type: 'like' } }),
    prisma.reaction.count({ where: { mangaId, chapterId, type: 'dislike' } }),
  ])

  res.json({ likes, dislikes, myReaction })
})
