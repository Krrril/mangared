import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { verifyToken } from '../utils/jwt.js'

/** req.userId уже проверен (см. optionalAuth) — просто смотрим isAdmin в базе, без 401/403 (используется на публичных роутах для превью админом). */
async function isRequesterAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  return !!user?.isAdmin
}

export const originalsRouter = Router()

/*
  "Originals" — авторская манга/манхва, которую пользователи публикуют
  сами (в отличие от каталога MangaDex выше — тот только проксируется,
  этот контент реально хранится в нашей базе + R2). requireAuth стоит
  точечно на каждом private-роуте, не на весь router — каталог и
  профили авторов должны быть доступны без входа.
*/

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

async function ensureUniqueUsername(base: string): Promise<string> {
  const root = slugify(base) || 'author'
  let candidate = root
  let suffix = 1
  // Коллизии редки (уникальный человекочитаемый ник) — обычный цикл
  // с инкрементом достаточно, отдельная блокировка не нужна.
  while (await prisma.authorProfile.findUnique({ where: { username: candidate } })) {
    candidate = `${root}-${suffix++}`
  }
  return candidate
}

async function getOrCreateAuthorProfile(userId: string) {
  const existing = await prisma.authorProfile.findUnique({ where: { userId } })
  if (existing) return existing

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const username = await ensureUniqueUsername(user.name || user.email.split('@')[0])
  return prisma.authorProfile.create({
    data: { userId, username, displayName: user.name },
  })
}

function publicAuthor(a: {
  id: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  boostyUrl: string | null
  followersCount: number
}) {
  return {
    id: a.id,
    username: a.username,
    displayName: a.displayName,
    bio: a.bio,
    avatarUrl: a.avatarUrl,
    boostyUrl: a.boostyUrl,
    followersCount: a.followersCount,
  }
}

/** Просмотры/лайки батчем для списка id — см. TitleStats в schema.prisma. Отсутствующая запись = ещё не было ни одного просмотра/лайка. */
async function titleStatsById(mangaIds: string[]): Promise<Map<string, { viewsCount: number; favoritesCount: number }>> {
  const rows = await prisma.titleStats.findMany({ where: { mangaId: { in: mangaIds } } })
  const byId = new Map(rows.map((r) => [r.mangaId, { viewsCount: r.viewsCount, favoritesCount: r.favoritesCount }]))
  for (const id of mangaIds) if (!byId.has(id)) byId.set(id, { viewsCount: 0, favoritesCount: 0 })
  return byId
}

// --- Каталог (публичный, только опубликованные) ---

const catalogQuerySchema = z.object({
  sort: z.enum(['new', 'popular']).optional().default('new'),
})

originalsRouter.get('/mangas', async (req, res) => {
  const parsed = catalogQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные параметры запроса' })
    return
  }

  const mangas = await prisma.userManga.findMany({
    where: { status: 'published' },
    include: { author: true, _count: { select: { chapters: true } } },
    orderBy:
      parsed.data.sort === 'popular'
        ? [{ author: { followersCount: 'desc' } }, { createdAt: 'desc' }]
        : { createdAt: 'desc' },
  })

  const stats = await titleStatsById(mangas.map((m) => m.id))

  res.json(
    mangas.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      coverUrl: m.coverUrl,
      genres: m.genres,
      contentType: m.contentType,
      chaptersCount: m._count.chapters,
      author: publicAuthor(m.author),
      ...stats.get(m.id),
    })),
  )
})

// optionalAuth — не блокирует гостей, но если пришёл валидный токен
// админа, позволяет превью тайтла/главы в любом статусе (не только
// published), см. "Просмотр как читатель" в docs/ARCHITECTURE.md.
originalsRouter.get('/mangas/:id', optionalAuth, async (req, res) => {
  const manga = await prisma.userManga.findUnique({
    where: { id: req.params.id },
    include: { author: true, chapters: { orderBy: { number: 'asc' }, select: { id: true, number: true, title: true, publishedAt: true } } },
  })

  if (!manga || (manga.status !== 'published' && !(await isRequesterAdmin(req.userId)))) {
    res.status(404).json({ error: 'Тайтл не найден' })
    return
  }

  const stats = (await titleStatsById([manga.id])).get(manga.id)!

  res.json({
    id: manga.id,
    title: manga.title,
    description: manga.description,
    coverUrl: manga.coverUrl,
    genres: manga.genres,
    contentType: manga.contentType,
    // Статус нужен фронту только чтобы показать баннер "предпросмотр
    // черновика/на модерации/отклонён" админу — для гостя тут всегда
    // 'published' (иначе запрос выше уже вернул бы 404).
    status: manga.status,
    author: publicAuthor(manga.author),
    chapters: manga.chapters,
    ...stats,
  })
})

originalsRouter.get('/mangas/:id/chapters/:chapterId', optionalAuth, async (req, res) => {
  const chapter = await prisma.chapter.findUnique({
    where: { id: req.params.chapterId },
    include: { manga: true },
  })

  if (!chapter || chapter.mangaId !== req.params.id || (chapter.manga.status !== 'published' && !(await isRequesterAdmin(req.userId)))) {
    res.status(404).json({ error: 'Глава не найдена' })
    return
  }

  // Счётчик прочтений засчитывается отдельным явным вызовом с фронтенда
  // (см. POST /api/stats/view, Reader.tsx) — там же дедупликация "не чаще
  // раза в день на пользователя+главу", здесь её не было (см. DECISIONS.md).

  res.json({
    id: chapter.id,
    mangaId: chapter.mangaId,
    number: chapter.number,
    title: chapter.title,
    pages: chapter.pages,
    contentType: chapter.manga.contentType,
  })
})

// --- Авторская студия (свои тайтлы, любой статус) ---

const createMangaSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(10).max(5000),
  coverUrl: z.string().url().optional(),
  genres: z.array(z.string().trim().min(1)).max(10).default([]),
  contentType: z.enum(['manga', 'manhwa', 'comic']),
  agreedToRules: z.literal(true, { errorMap: () => ({ message: 'Нужно принять правила публикации' }) }),
})

originalsRouter.post('/mangas', requireAuth, async (req, res) => {
  const parsed = createMangaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }

  const author = await getOrCreateAuthorProfile(req.userId!)
  const { agreedToRules: _agreedToRules, ...data } = parsed.data

  const manga = await prisma.userManga.create({
    data: { ...data, authorId: author.id, status: 'draft', rulesAgreedAt: new Date() },
  })

  res.status(201).json(manga)
})

originalsRouter.get('/mine', requireAuth, async (req, res) => {
  const author = await prisma.authorProfile.findUnique({ where: { userId: req.userId } })
  if (!author) {
    res.json([])
    return
  }

  const mangas = await prisma.userManga.findMany({
    where: { authorId: author.id },
    include: { _count: { select: { chapters: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  const stats = await titleStatsById(mangas.map((m) => m.id))

  res.json(mangas.map((m) => ({ ...m, chaptersCount: m._count.chapters, ...stats.get(m.id) })))
})

async function loadOwnManga(userId: string, mangaId: string) {
  const manga = await prisma.userManga.findUnique({
    where: { id: mangaId },
    include: { author: true, chapters: { orderBy: { number: 'asc' } } },
  })
  if (!manga || manga.author.userId !== userId) return null
  return manga
}

originalsRouter.get('/mine/:id', requireAuth, async (req, res) => {
  const manga = await loadOwnManga(req.userId!, req.params.id)
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден' })
    return
  }
  const stats = (await titleStatsById([manga.id])).get(manga.id)!
  res.json({ ...manga, ...stats })
})

// Экспортируется для переиспользования в routes/admin.ts — редактирование
// метаданных тайтла администратором использует ту же схему валидации.
export const updateMangaSchema = createMangaSchema.omit({ agreedToRules: true }).partial()

originalsRouter.patch('/mine/:id', requireAuth, async (req, res) => {
  const manga = await loadOwnManga(req.userId!, req.params.id)
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден' })
    return
  }
  if (manga.status === 'pending' || manga.status === 'published') {
    res.status(409).json({ error: 'Нельзя редактировать тайтл на модерации или уже опубликованный' })
    return
  }

  const parsed = updateMangaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }

  const updated = await prisma.userManga.update({ where: { id: manga.id }, data: parsed.data })
  res.json(updated)
})

originalsRouter.post('/mine/:id/submit', requireAuth, async (req, res) => {
  const manga = await loadOwnManga(req.userId!, req.params.id)
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден' })
    return
  }
  if (manga.status !== 'draft' && manga.status !== 'rejected') {
    res.status(409).json({ error: 'Отправить на модерацию можно только черновик или отклонённый тайтл' })
    return
  }
  if (manga.chapters.length === 0) {
    res.status(400).json({ error: 'Добавьте хотя бы одну главу перед отправкой на модерацию' })
    return
  }

  const updated = await prisma.userManga.update({ where: { id: manga.id }, data: { status: 'pending' } })
  res.json(updated)
})

const createChapterSchema = z.object({
  number: z.number().positive(),
  title: z.string().trim().max(200).optional(),
  pages: z.array(z.string().url()).min(1).max(300),
})

originalsRouter.post('/mine/:id/chapters', requireAuth, async (req, res) => {
  const manga = await loadOwnManga(req.userId!, req.params.id)
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден' })
    return
  }

  const parsed = createChapterSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }

  const existing = await prisma.chapter.findUnique({
    where: { mangaId_number: { mangaId: manga.id, number: parsed.data.number } },
  })
  if (existing) {
    res.status(409).json({ error: `Глава ${parsed.data.number} уже существует` })
    return
  }

  const chapter = await prisma.chapter.create({ data: { ...parsed.data, mangaId: manga.id } })
  res.status(201).json(chapter)
})

// --- Профиль автора: редактирование своего + публичный просмотр чужого ---

const updateAuthorProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  bio: z.string().trim().max(1000).optional(),
  avatarUrl: z.string().url().optional(),
  boostyUrl: z.string().url().optional().or(z.literal('')),
})

originalsRouter.get('/authors/me', requireAuth, async (req, res) => {
  const author = await getOrCreateAuthorProfile(req.userId!)
  res.json(publicAuthor(author))
})

originalsRouter.patch('/authors/me', requireAuth, async (req, res) => {
  const parsed = updateAuthorProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }

  const author = await getOrCreateAuthorProfile(req.userId!)
  const { boostyUrl, ...rest } = parsed.data
  const updated = await prisma.authorProfile.update({
    where: { id: author.id },
    data: { ...rest, ...(boostyUrl !== undefined ? { boostyUrl: boostyUrl || null } : {}) },
  })
  res.json(publicAuthor(updated))
})

originalsRouter.get('/authors/:username', async (req, res) => {
  const author = await prisma.authorProfile.findUnique({
    where: { username: req.params.username },
    include: { mangas: { where: { status: 'published' }, include: { _count: { select: { chapters: true } } } } },
  })

  if (!author) {
    res.status(404).json({ error: 'Автор не найден' })
    return
  }

  // "Суммарные прочтения" — сумма viewsCount по всем главам всех
  // опубликованных тайтлов автора. Простой счётчик, не аналитика с
  // графиками (той сознательно нет на этом этапе, см. ROADMAP).
  const readsAgg = await prisma.chapter.aggregate({
    where: { manga: { authorId: author.id, status: 'published' } },
    _sum: { viewsCount: true },
  })

  // Профиль публичный (без requireAuth), но если пришёл валидный токен —
  // можно сразу сказать фронту, подписан ли этот конкретный зритель и не
  // его ли это собственный профиль, не заставляя делать второй запрос.
  let isFollowing = false
  let isOwnProfile = false
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (token) {
    try {
      const { userId } = verifyToken(token)
      if (userId === author.userId) {
        isOwnProfile = true
      } else {
        const follow = await prisma.authorFollow.findUnique({
          where: { followerId_authorId: { followerId: userId, authorId: author.id } },
        })
        isFollowing = !!follow
      }
    } catch {
      // невалидный/истёкший токен — просто считаем гостем, не 401-им публичный роут
    }
  }

  res.json({
    ...publicAuthor(author),
    worksCount: author.mangas.length,
    totalReads: readsAgg._sum.viewsCount ?? 0,
    isFollowing,
    isOwnProfile,
    mangas: author.mangas.map((m) => ({
      id: m.id,
      title: m.title,
      coverUrl: m.coverUrl,
      contentType: m.contentType,
      chaptersCount: m._count.chapters,
    })),
  })
})

originalsRouter.post('/authors/:username/follow', requireAuth, async (req, res) => {
  const author = await prisma.authorProfile.findUnique({ where: { username: req.params.username } })
  if (!author) {
    res.status(404).json({ error: 'Автор не найден' })
    return
  }
  if (author.userId === req.userId) {
    res.status(400).json({ error: 'Нельзя подписаться на самого себя' })
    return
  }

  const existing = await prisma.authorFollow.findUnique({
    where: { followerId_authorId: { followerId: req.userId!, authorId: author.id } },
  })

  if (existing) {
    await prisma.$transaction([
      prisma.authorFollow.delete({ where: { id: existing.id } }),
      prisma.authorProfile.update({ where: { id: author.id }, data: { followersCount: { decrement: 1 } } }),
    ])
    res.json({ following: false })
    return
  }

  await prisma.$transaction([
    prisma.authorFollow.create({ data: { followerId: req.userId!, authorId: author.id } }),
    prisma.authorProfile.update({ where: { id: author.id }, data: { followersCount: { increment: 1 } } }),
  ])
  res.json({ following: true })
})
