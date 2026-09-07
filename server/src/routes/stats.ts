import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import geoip from 'geoip-lite'
import { prisma } from '../db.js'
import { optionalAuth } from '../middleware/auth.js'
import { OWNER_COOKIE, VISIT_ID_COOKIE, VISIT_SESSION_MS, visitCookieOptions } from '../utils/visitCookies.js'

export const statsRouter = Router()

const MAX_IDS = 100

/**
 * Батч-чтение счётчиков — GET /api/stats?ids=id1,id2,id3. Используется
 * карточками тайтулов MangaDex (Originals получают те же числа сразу
 * вшитыми в свои ответы, см. routes/originals.ts — у них и так свой
 * запрос к БД на каждую карточку, второй поход сюда не нужен).
 */
statsRouter.get('/', async (req, res) => {
  const idsParam = typeof req.query.ids === 'string' ? req.query.ids : ''
  const ids = [...new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS)

  const byId: Record<string, { views: number; favorites: number }> = {}
  for (const id of ids) byId[id] = { views: 0, favorites: 0 }

  if (ids.length > 0) {
    const rows = await prisma.titleStats.findMany({ where: { mangaId: { in: ids } } })
    for (const row of rows) byId[row.mangaId] = { views: row.viewsCount, favorites: row.favoritesCount }
  }

  res.json(byId)
})

const recordViewSchema = z.object({
  mangaId: z.string().min(1),
  chapterId: z.string().min(1),
  // На чьей стороне живёт глава — от этого зависит, нужно ли параллельно
  // обновлять Chapter.viewsCount (используется в "суммарных прочтениях"
  // на публичном профиле автора, см. routes/originals.ts).
  source: z.enum(['mangadex', 'original']),
})

/**
 * Засчитывает открытие главы в читалке — вызывается один раз с фронтенда
 * (см. Reader.tsx) при открытии главы, для обоих источников контента.
 * Не требует авторизации (гости тоже считаются, см. schema.prisma), но
 * если токен есть — используется для дедупликации "не чаще раза в день
 * на пользователя+главу" (решение пользователя, см. DECISIONS.md).
 */
statsRouter.post('/view', optionalAuth, async (req, res) => {
  const parsed = recordViewSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные данные' })
    return
  }
  const { mangaId, chapterId, source } = parsed.data
  const userId = req.userId ?? null
  const viewDate = new Date(new Date().toISOString().slice(0, 10))

  let isNewView = true
  if (userId) {
    isNewView = await prisma.chapterView
      .create({ data: { userId, mangaId, chapterId, viewDate } })
      .then(() => true)
      // Уникальный индекс (userId, chapterId, viewDate) уже сработал —
      // этот пользователь сегодня эту главу уже посмотрел, не считаем повторно.
      .catch(() => false)
  } else {
    // Гость — считаем безусловно, без защиты от накрутки (см. schema.prisma).
    await prisma.chapterView.create({ data: { userId: null, mangaId, chapterId, viewDate } })
  }

  if (isNewView) {
    await prisma.titleStats.upsert({
      where: { mangaId },
      create: { mangaId, viewsCount: 1 },
      update: { viewsCount: { increment: 1 } },
    })
    if (source === 'original') {
      await prisma.chapter.update({ where: { id: chapterId }, data: { viewsCount: { increment: 1 } } }).catch(() => null)
    }
  }

  res.status(204).end()
})

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i

const recordVisitSchema = z.object({
  path: z.string().trim().min(1).max(300),
})

/**
 * Лёгкая собственная аналитика (см. VisitLog в schema.prisma) — вызывается
 * с фронтенда на каждый просмотр страницы (см. services/analytics/index.ts,
 * тот же хук, что шлёт события в GA4/Метрику, — /admin сознательно исключён
 * там же). Не требует авторизации (посетители не залогинены), не хранит
 * сам IP — geoip-lite резолвит страну/город на лету, синхронно и без
 * сетевого запроса (офлайн-база), только результат уходит в БД.
 *
 * Дедупликация — httpOnly-кука visit_id (см. utils/visitCookies.ts):
 * первый запрос без куки создаёт новую запись визита и куку на 9 часов;
 * пока кука жива, повторные запросы (переходы между страницами в рамках
 * той же сессии) только обновляют lastSeenAt существующей записи, не
 * плодя новых — "визит" тут означает сессию, а не отдельный просмотр
 * страницы. is_owner (см. POST /admin/exclude-visits) — визиты с этой
 * меткой не считаются вообще, ни новой записью, ни обновлением.
 */
statsRouter.post('/visit', async (req, res) => {
  const parsed = recordVisitSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные данные' })
    return
  }

  if (req.cookies?.[OWNER_COOKIE] === 'true') {
    res.status(204).end()
    return
  }

  const existingVisitId: string | undefined = req.cookies?.[VISIT_ID_COOKIE]
  if (existingVisitId) {
    const updated = await prisma.visitLog.updateMany({
      where: { visitId: existingVisitId },
      data: { lastSeenAt: new Date() },
    })
    if (updated.count > 0) {
      res.status(204).end()
      return
    }
    // Кука есть, но записи под этим visitId нет (устарела/повреждена) —
    // считаем новым визитом ниже, с новым visitId и новой кукой.
  }

  const device = MOBILE_UA.test(req.headers['user-agent'] ?? '') ? 'mobile' : 'desktop'
  // req.ip уважает X-Forwarded-For только благодаря app.set('trust proxy', true) в index.ts.
  const geo = req.ip ? geoip.lookup(req.ip) : null
  const visitId = randomUUID()

  await prisma.visitLog.create({
    data: {
      path: parsed.data.path,
      device,
      country: geo?.country || null,
      city: geo?.city || null,
      region: geo?.region || null,
      visitId,
    },
  })

  res.cookie(VISIT_ID_COOKIE, visitId, visitCookieOptions(VISIT_SESSION_MS))
  res.status(204).end()
})
