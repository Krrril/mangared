import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { containsProfanity } from '../constants/profanity.js'

export const commentsRouter = Router()

/*
  Комментарии под тайтлом целиком (chapterId = null) и под конкретной
  главой (chapterId задан) — см. schema.prisma, Comment. mangaId — то же
  единое пространство id, что и у TitleStats/Favorite (MangaDex UUID или
  UserManga.id), см. комментарий там же. Без предварительной модерации
  (см. задачу) — публикуется сразу, поэтому единственные барьеры: rate
  limit ниже и простой словарь стоп-слов (containsProfanity).
*/

const MAX_TEXT_LENGTH = 2000

// 10 комментариев/минуту с IP — тот же подход к rate limiting, что и у
// остальных пишущих эндпоинтов сайта (см. registerLimiter в routes/auth.ts,
// uploadLimiter в routes/upload.ts) — защита от флуда, не от одного лишнего клика.
const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много комментариев, подождите немного' },
})

const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много жалоб, подождите немного' },
})

function publicCommentAuthor(u: {
  id: string
  name: string
  authorProfile: { username: string; displayName: string; avatarUrl: string | null } | null
}) {
  return {
    id: u.id,
    name: u.authorProfile?.displayName ?? u.name,
    avatarUrl: u.authorProfile?.avatarUrl ?? null,
    username: u.authorProfile?.username ?? null,
  }
}

const USER_SELECT = {
  id: true,
  name: true,
  authorProfile: { select: { username: true, displayName: true, avatarUrl: true } },
} as const

const listQuerySchema = z.object({
  mangaId: z.string().min(1),
  // Отсутствует — комментарии под тайтлом целиком (chapterId IS NULL).
  chapterId: z.string().min(1).optional(),
})

/**
 * Чтение — публично, без авторизации (комментировать могут только
 * зарегистрированные, см. задачу, но читать — все). optionalAuth только
 * чтобы пометить "mine" у своих комментариев (кнопка удаления на фронте).
 */
commentsRouter.get('/', optionalAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные параметры запроса' })
    return
  }
  const { mangaId, chapterId } = parsed.data

  const comments = await prisma.comment.findMany({
    where: { mangaId, chapterId: chapterId ?? null, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: USER_SELECT } },
    take: 200,
  })

  res.json(
    comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt,
      author: publicCommentAuthor(c.user),
      mine: c.userId === req.userId,
    })),
  )
})

const createCommentSchema = z.object({
  mangaId: z.string().min(1),
  chapterId: z.string().min(1).optional(),
  text: z.string().trim().min(1, 'Комментарий не может быть пустым').max(MAX_TEXT_LENGTH, `Не длиннее ${MAX_TEXT_LENGTH} символов`),
})

commentsRouter.post('/', requireAuth, commentLimiter, async (req, res) => {
  const parsed = createCommentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }
  const { mangaId, chapterId, text } = parsed.data

  if (containsProfanity(text)) {
    res.status(400).json({ error: 'Комментарий содержит недопустимые слова' })
    return
  }

  const comment = await prisma.comment.create({
    data: { userId: req.userId!, mangaId, chapterId: chapterId ?? null, text },
    include: { user: { select: USER_SELECT } },
  })

  // Уведомление автору — только для Originals (у MangaDex-тайтлов нет
  // локального автора-получателя, см. тот же принцип в routes/favorites.ts)
  // и только если комментатор не комментирует сам себя.
  const manga = await prisma.userManga.findUnique({ where: { id: mangaId }, select: { author: { select: { userId: true } } } })
  if (manga && manga.author.userId !== req.userId) {
    await prisma.notification.create({
      data: { userId: manga.author.userId, type: 'comment', actorId: req.userId!, mangaId, chapterId: chapterId ?? null },
    })
  }

  res.status(201).json({
    id: comment.id,
    text: comment.text,
    createdAt: comment.createdAt,
    author: publicCommentAuthor(comment.user),
    mine: true,
  })
})

/** Автор удаляет свой комментарий (soft delete). Админ использует отдельный DELETE /admin/comments/:id (см. routes/admin.ts) — с логом и авто-закрытием жалоб. */
commentsRouter.delete('/:id', requireAuth, async (req, res) => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } })
  if (!comment || comment.deletedAt) {
    res.status(404).json({ error: 'Комментарий не найден' })
    return
  }
  if (comment.userId !== req.userId) {
    res.status(403).json({ error: 'Можно удалить только свой комментарий' })
    return
  }

  await prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } })
  res.json({ ok: true })
})

/**
 * "Пожаловаться" — падает в очередь /admin → Moderation → Comment reports
 * (см. задачу). Повторная жалоба того же пользователя на тот же
 * комментарий — идемпотентно ok:true, не ошибка (см. @@unique в схеме).
 */
commentsRouter.post('/:id/report', requireAuth, reportLimiter, async (req, res) => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } })
  if (!comment || comment.deletedAt) {
    res.status(404).json({ error: 'Комментарий не найден' })
    return
  }

  await prisma.commentReport
    .create({ data: { commentId: comment.id, userId: req.userId! } })
    .catch(() => null) // уже жаловался — не ошибка

  res.status(201).json({ ok: true })
})
