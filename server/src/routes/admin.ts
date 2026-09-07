import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { updateMangaSchema } from './originals.js'
import { OWNER_COOKIE, OWNER_EXCLUSION_MS, visitCookieOptions } from '../utils/visitCookies.js'

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)

/*
  Лог административных действий (см. AdminActionLog в schema.prisma) —
  вызывается из каждого мутирующего роута ниже. adminName берём один раз
  здесь, а не полагаемся на req.userId при чтении лога — если админа
  потом удалят, лог не должен превращаться в нечитаемый набор id.
*/
async function logAction(adminId: string, action: string, targetType: string, targetId: string, details?: string) {
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { name: true } })
  await prisma.adminActionLog.create({
    data: { adminId, adminName: admin?.name ?? 'unknown', action, targetType, targetId, details },
  })
}

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
      ageRating: m.ageRating,
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
  await logAction(req.userId!, 'manga.approve', 'manga', manga.id, `«${manga.title}»`)
  res.json({ ok: true })
})

adminRouter.post('/originals/:id/reject', async (req, res) => {
  const manga = await findPendingManga(req.params.id)
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден или уже не на модерации' })
    return
  }
  await prisma.userManga.update({ where: { id: manga.id }, data: { status: 'rejected' } })
  await logAction(req.userId!, 'manga.reject', 'manga', manga.id, `«${manga.title}»`)
  res.json({ ok: true })
})

// --- Полный контроль над контентом Originals (просмотр/правка/удаление) ---
// MangaDex-каталог сюда не входит: мы его не храним, только проксируем
// (см. docs/ARCHITECTURE.md, "Источник контента") — удалить или отредактировать
// чужой тайтл с MangaDex физически нечем, тут нет своей копии.

const contentQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'published', 'rejected']).optional(),
  q: z.string().trim().optional(),
})

/** Список тайтлов Originals любого статуса — для вкладки "Контент" в /admin, в отличие от /originals/pending (только pending). */
adminRouter.get('/mangas', async (req, res) => {
  const parsed = contentQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные параметры запроса' })
    return
  }
  const { status, q } = parsed.data

  const mangas = await prisma.userManga.findMany({
    where: {
      status,
      title: q ? { contains: q, mode: 'insensitive' } : undefined,
    },
    include: { author: true, _count: { select: { chapters: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  // Кто и когда одобрил/отклонил — только для архивных вкладок
  // ("Approved"/"Rejected" в /admin/moderation), не тратим лишний запрос
  // на список pending/draft, где решения ещё не было.
  const decisionByMangaId = new Map<string, { admin: string; at: string; action: string }>()
  if (status === 'published' || status === 'rejected') {
    const logs = await prisma.adminActionLog.findMany({
      where: {
        targetType: 'manga',
        action: { in: ['manga.approve', 'manga.reject'] },
        targetId: { in: mangas.map((m) => m.id) },
      },
      orderBy: { createdAt: 'desc' },
    })
    // Самая свежая запись на тайтл побеждает (например, отклонён -> автор
    // исправил -> одобрен — в архиве должно быть видно последнее решение).
    for (const log of logs) {
      if (!decisionByMangaId.has(log.targetId)) {
        decisionByMangaId.set(log.targetId, { admin: log.adminName, at: log.createdAt.toISOString(), action: log.action })
      }
    }
  }

  res.json(
    mangas.map((m) => ({
      id: m.id,
      title: m.title,
      coverUrl: m.coverUrl,
      status: m.status,
      contentType: m.contentType,
      ageRating: m.ageRating,
      chaptersCount: m._count.chapters,
      updatedAt: m.updatedAt,
      author: { username: m.author.username, displayName: m.author.displayName },
      decision: decisionByMangaId.get(m.id) ?? null,
    })),
  )
})

/**
 * Полная карточка тайтла для детального просмотра на модерации — в
 * отличие от GET /mangas (список) включает все главы целиком, вместе с
 * массивом URL-ов страниц (не только их числом), чтобы админ мог увидеть
 * миниатюры прямо в /admin, не переходя на публичную страницу чтения
 * (которой для pending/rejected тайтлов read-only просмотрщику всё равно
 * не давали бы — см. "Просмотр как читатель" ниже про optionalAuth).
 */
adminRouter.get('/mangas/:id', async (req, res) => {
  const manga = await prisma.userManga.findUnique({
    where: { id: req.params.id },
    include: { author: true, chapters: { orderBy: { number: 'asc' } } },
  })
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден' })
    return
  }

  res.json({
    id: manga.id,
    title: manga.title,
    description: manga.description,
    coverUrl: manga.coverUrl,
    genres: manga.genres,
    contentType: manga.contentType,
    ageRating: manga.ageRating,
    status: manga.status,
    createdAt: manga.createdAt,
    updatedAt: manga.updatedAt,
    author: { username: manga.author.username, displayName: manga.author.displayName },
    chapters: manga.chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      pages: c.pages,
      publishedAt: c.publishedAt,
    })),
  })
})

/**
 * Правка метаданных тайтла от лица администратора — та же схема
 * валидации, что и у автора (routes/originals.ts, PATCH /mine/:id), но
 * без проверки авторства и без ограничения по статусу (автору нельзя
 * редактировать pending/published, админу — можно, ровно для того и
 * существует этот роут).
 */
adminRouter.patch('/mangas/:id', async (req, res) => {
  const manga = await prisma.userManga.findUnique({ where: { id: req.params.id } })
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден' })
    return
  }

  const parsed = updateMangaSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    return
  }

  const updated = await prisma.userManga.update({ where: { id: manga.id }, data: parsed.data })
  await logAction(req.userId!, 'manga.edit', 'manga', manga.id, `«${manga.title}»`)
  res.json(updated)
})

/** Необратимо: удаляет тайтл и каскадом все его главы (см. onDelete: Cascade в schema.prisma). Файлы страниц в R2 при этом не удаляются (см. ARCHITECTURE.md). */
adminRouter.delete('/mangas/:id', async (req, res) => {
  const manga = await prisma.userManga.findUnique({
    where: { id: req.params.id },
    include: { author: true, _count: { select: { chapters: true } } },
  })
  if (!manga) {
    res.status(404).json({ error: 'Тайтл не найден' })
    return
  }

  await prisma.userManga.delete({ where: { id: manga.id } })
  await logAction(
    req.userId!,
    'manga.delete',
    'manga',
    manga.id,
    `«${manga.title}» автора ${manga.author.displayName} (${manga._count.chapters} глав)`,
  )
  res.json({ ok: true })
})

/** Необратимо: удаляет одну главу целиком. */
adminRouter.delete('/chapters/:id', async (req, res) => {
  const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id }, include: { manga: true } })
  if (!chapter) {
    res.status(404).json({ error: 'Глава не найдена' })
    return
  }

  await prisma.chapter.delete({ where: { id: chapter.id } })
  await logAction(req.userId!, 'chapter.delete', 'chapter', chapter.id, `глава ${chapter.number} тайтла «${chapter.manga.title}»`)
  res.json({ ok: true })
})

/** Необратимо: удаляет одну страницу (изображение) внутри главы по её порядковому номеру, не всю главу. */
adminRouter.delete('/chapters/:id/pages/:index', async (req, res) => {
  const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id }, include: { manga: true } })
  if (!chapter) {
    res.status(404).json({ error: 'Глава не найдена' })
    return
  }

  const index = Number(req.params.index)
  if (!Number.isInteger(index) || index < 0 || index >= chapter.pages.length) {
    res.status(400).json({ error: 'Некорректный номер страницы' })
    return
  }

  const pages = chapter.pages.filter((_, i) => i !== index)
  await prisma.chapter.update({ where: { id: chapter.id }, data: { pages } })
  await logAction(
    req.userId!,
    'page.delete',
    'chapter',
    chapter.id,
    `страница ${index + 1} главы ${chapter.number} тайтла «${chapter.manga.title}»`,
  )
  res.json({ ok: true, pages })
})

/**
 * Необратимо: удаляет пользователя. Каскадом (см. schema.prisma) уходят
 * его избранное, прогресс чтения — и, если у него есть профиль автора,
 * ВСЕ его тайтлы Originals со всеми главами (AuthorProfile -> UserManga ->
 * Chapter, все onDelete: Cascade). Поэтому в лог пишем количество тайтлов
 * заранее — после удаления эту информацию уже неоткуда взять.
 */
adminRouter.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.userId) {
    res.status(400).json({ error: 'Нельзя удалить самого себя' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { authorProfile: { include: { _count: { select: { mangas: true } } } } },
  })
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' })
    return
  }

  await prisma.user.delete({ where: { id: user.id } })
  const worksNote = user.authorProfile ? `, включая ${user.authorProfile._count.mangas} тайтл(ов) автора` : ''
  await logAction(req.userId!, 'user.delete', 'user', user.id, `${user.email} (${user.name})${worksNote}`)
  res.json({ ok: true })
})

/** История административных действий — см. AdminActionLog. */
adminRouter.get('/logs', async (_req, res) => {
  const logs = await prisma.adminActionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  res.json(logs)
})

// --- Лёгкая собственная аналитика посещаемости (см. VisitLog, routes/stats.ts) ---

const analyticsQuerySchema = z.object({
  // 7 или 30 дней — тот же диапазон, что предлагает вкладка "Analytics" в /admin.
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
})

/**
 * Считаем в приложении, а не через Prisma groupBy с сортировкой по
 * агрегату (не везде поддерживается предсказуемо в текущей версии Prisma)
 * — при объёме трафика, для которого это вообще имеет смысл (не GA4-масштаб,
 * см. комментарий у VisitLog в schema.prisma), выборка за 30 дней — это
 * тысячи, не миллионы строк, посчитать в JS дешевле, чем разбираться со
 * сложным SQL ради него.
 */
adminRouter.get('/analytics', async (req, res) => {
  const parsed = analyticsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные параметры запроса' })
    return
  }
  const since = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000)

  const rows = await prisma.visitLog.findMany({
    where: { createdAt: { gte: since } },
    select: { device: true, country: true, city: true, region: true },
  })

  const byDevice: Record<string, number> = {}
  const byCountry: Record<string, number> = {}
  // Город без страны неоднозначен (тёзки в разных странах) — ключ "город, регион, страна".
  const byCity: Record<string, { city: string; region: string | null; country: string | null; count: number }> = {}
  for (const row of rows) {
    byDevice[row.device] = (byDevice[row.device] ?? 0) + 1
    const country = row.country ?? 'unknown'
    byCountry[country] = (byCountry[country] ?? 0) + 1

    if (row.city) {
      const key = `${row.city}|${row.region ?? ''}|${row.country ?? ''}`
      byCity[key] ??= { city: row.city, region: row.region, country: row.country, count: 0 }
      byCity[key].count++
    }
  }

  res.json({
    days: parsed.data.days,
    total: rows.length,
    byDevice,
    byCountry: Object.entries(byCountry)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    byCity: Object.values(byCity)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  })
})

/**
 * "Не считать мои визиты" — ставит долгоживущую (1 год) куку is_owner на
 * БРАУЗЕР админа, нажавшего кнопку (см. Admin.tsx), не на его IP/аккаунт:
 * это осознанный выбор из задачи ("не привязывайся к IP"), поэтому
 * исключение действует только на этом конкретном устройстве/браузере, и
 * его можно так же снять — см. DELETE ниже. POST /stats/visit (см.
 * routes/stats.ts) видит эту куку и вообще не создаёт и не обновляет
 * запись VisitLog, пока она жива.
 */
adminRouter.post('/exclude-visits', (_req, res) => {
  res.cookie(OWNER_COOKIE, 'true', visitCookieOptions(OWNER_EXCLUSION_MS))
  res.json({ ok: true })
})

/** Обратное действие — снова считать визиты с этого браузера. */
adminRouter.delete('/exclude-visits', (_req, res) => {
  res.clearCookie(OWNER_COOKIE, { path: '/' })
  res.json({ ok: true })
})
