import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { AGE_RATING_LABELS } from '../constants/ageRating.js'
import type { AgeRatingValue } from '../constants/ageRating.js'
import {
  escapeHtml,
  isPostingEnabled,
  logTelegram,
  redact,
  sendMessage,
  sendPhoto,
  telegramConfig,
} from './telegram.js'
import { TEXTS, genreLabel, languageName } from './telegramTexts.js'

/*
  Автопубликация Originals в Telegram-канал.

  Ключевые правила:
    - ВСЁ здесь вызывается "огнём и забыл" (void ...catch): ошибка Telegram
      или БД никогда не ломает одобрение тайтла или публикацию главы.
    - Выключено (TELEGRAM_POST_ENABLED != true, нет токена/канала) — функции
      сразу выходят и НЕ пишут в БД: сайт работает как раньше.
    - Повторов нет: уникальный индекс (kind, refId) в TelegramPost; строка
      создаётся ДО отправки, поэтому два одновременных вызова не опубликуют
      пост дважды.
    - Только одобренные (status published) тайтлы и их главы.
    - Обложка автора в посте — только при TELEGRAM_ORIGINALS_COVERS=true
      (см. комментарий в telegram.ts: пользовательское соглашение не даёт
      права показывать обложки вне сайта).
*/

const CHAPTER_DEBOUNCE_MS = 10 * 60_000
const CHAPTER_MAX_WAIT_MS = 60 * 60_000
const SENDING_STALE_MS = 15 * 60_000

function utm(url: string, campaign: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}utm_source=telegram&utm_medium=bot&utm_campaign=${campaign}`
}

/** Создаёт строку-бронь; false — такая запись уже есть (дубль). */
async function reserve(kind: string, refId: string, label: string | null, status = 'pending'): Promise<boolean> {
  try {
    await prisma.telegramPost.create({ data: { kind, refId, label, status } })
    return true
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false
    throw err
  }
}

async function markResult(kind: string, refIds: string[], result: { ok: true; messageIds: number[] } | { ok: false; error: string }) {
  await prisma.telegramPost.updateMany({
    where: { kind, refId: { in: refIds } },
    data: result.ok
      ? { status: 'sent', error: null, messageId: result.messageIds[0] ?? null, messageIds: result.messageIds }
      : { status: 'failed', error: result.error.slice(0, 500) },
  })
}

// ---------------------------------------------------------------------------
// Новый тайтл Originals
// ---------------------------------------------------------------------------

export function composeTitlePost(manga: {
  id: string
  title: string
  coverUrl: string | null
  genres: string[]
  ageRating: string
  primaryLanguage: string
  author: { username: string; displayName: string }
}): { text: string; coverUrl: string | null } {
  const cfg = telegramConfig()
  const t = TEXTS[cfg.lang]
  const titleUrl = utm(`${cfg.siteUrl}/originals/${manga.id}`, 'originals_title')
  const authorUrl = utm(`${cfg.siteUrl}/author/${encodeURIComponent(manga.author.username)}`, 'originals_title')
  const genres = manga.genres.map((g) => genreLabel(g, cfg.lang)).join(', ')
  const age = AGE_RATING_LABELS[manga.ageRating as AgeRatingValue]
  const lines = [
    `<b>${t.newTitle}</b>`,
    '',
    `<a href="${escapeHtml(titleUrl)}">${escapeHtml(manga.title)}</a>`,
    `${t.author}: <a href="${escapeHtml(authorUrl)}">${escapeHtml(manga.author.displayName)}</a>`,
  ]
  if (genres) lines.push(`${t.genres}: ${escapeHtml(genres)}`)
  const meta: string[] = []
  if (age && manga.ageRating !== 'unrated') meta.push(`${t.age}: ${age}`)
  meta.push(`${t.language}: ${escapeHtml(languageName(manga.primaryLanguage, cfg.lang))}`)
  lines.push(meta.join(' · '))
  return { text: lines.join('\n'), coverUrl: manga.coverUrl }
}

/** Одобрение тайтла → пост. Безопасно звать без await; не бросает. */
export function postOriginalTitle(mangaId: string): void {
  void doPostOriginalTitle(mangaId).catch((err) => logTelegram('postOriginalTitle:', err))
}

async function doPostOriginalTitle(mangaId: string): Promise<void> {
  if (!isPostingEnabled()) return
  const manga = await prisma.userManga.findUnique({ where: { id: mangaId }, include: { author: true } })
  if (!manga || manga.status !== 'published') return
  if (!(await reserve('original_title', manga.id, manga.title))) return // дубль
  await sendTitleRow(manga.id)
}

/** Отправка поста тайтла для уже существующей строки (первая отправка и "Повторить"). */
async function sendTitleRow(mangaId: string): Promise<void> {
  const manga = await prisma.userManga.findUnique({ where: { id: mangaId }, include: { author: true } })
  if (!manga || manga.status !== 'published') {
    await prisma.telegramPost.updateMany({ where: { kind: 'original_title', refId: mangaId }, data: { status: 'skipped', error: 'тайтл не опубликован' } })
    return
  }
  const cfg = telegramConfig()
  const post = composeTitlePost(manga)
  let result
  try {
    result =
      cfg.originalsCovers && post.coverUrl
        ? await sendPhoto(post.coverUrl, post.text)
        : await sendMessage(post.text)
  } catch (err) {
    result = { ok: false as const, error: redact(err instanceof Error ? err.message : String(err)) }
  }
  await markResult('original_title', [mangaId], result)
}

// ---------------------------------------------------------------------------
// Новые главы Originals (пачки склеиваем в один пост)
// ---------------------------------------------------------------------------

/** Глава опубликована у одобренного тайтла → ставим в очередь (пост уйдёт через 10 минут после последней главы пачки). */
export function enqueueOriginalChapter(chapterId: string, mangaId: string): void {
  void doEnqueueChapter(chapterId, mangaId).catch((err) => logTelegram('enqueueOriginalChapter:', err))
}

async function doEnqueueChapter(chapterId: string, mangaId: string): Promise<void> {
  if (!isPostingEnabled()) return
  const manga = await prisma.userManga.findUnique({ where: { id: mangaId }, select: { status: true, title: true } })
  if (!manga || manga.status !== 'published') return
  await reserve('original_chapter', chapterId, manga.title)
}

let flushing = false

/**
 * Берёт созданные ранее pending-главы, группирует по тайтлу и отправляет по
 * одному посту на тайтл. Вызывается таймером (см. startTelegramScheduler),
 * при старте сервера и из крон-эндпоинта подборки. Не бросает.
 */
export async function flushChapterPosts(): Promise<{ posted: number }> {
  if (flushing || !isPostingEnabled()) return { posted: 0 }
  flushing = true
  let posted = 0
  try {
    const now = Date.now()
    // Зависшие "в работе" (процесс упал посреди отправки) — в failed, админ может повторить.
    await prisma.telegramPost.updateMany({
      where: { status: 'sending', updatedAt: { lt: new Date(now - SENDING_STALE_MS) } },
      data: { status: 'failed', error: 'прервано (сервер перезапускался)' },
    })

    const pending = await prisma.telegramPost.findMany({
      where: { kind: 'original_chapter', status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })
    if (pending.length === 0) return { posted: 0 }

    const chapters = await prisma.chapter.findMany({
      where: { id: { in: pending.map((p) => p.refId) } },
      select: { id: true, number: true, mangaId: true },
    })
    const chapterById = new Map(chapters.map((c) => [c.id, c]))

    // Группировка по тайтлу; строки удалённых глав помечаем skipped.
    const groups = new Map<string, { rows: typeof pending; numbers: { id: string; number: number }[] }>()
    for (const row of pending) {
      const ch = chapterById.get(row.refId)
      if (!ch) {
        await prisma.telegramPost.update({ where: { id: row.id }, data: { status: 'skipped', error: 'глава удалена' } })
        continue
      }
      const g = groups.get(ch.mangaId) ?? { rows: [], numbers: [] }
      g.rows.push(row)
      g.numbers.push({ id: ch.id, number: ch.number })
      groups.set(ch.mangaId, g)
    }

    for (const [mangaId, group] of groups) {
      const newest = Math.max(...group.rows.map((r) => r.createdAt.getTime()))
      const oldest = Math.min(...group.rows.map((r) => r.createdAt.getTime()))
      const ready = now - newest >= CHAPTER_DEBOUNCE_MS || now - oldest >= CHAPTER_MAX_WAIT_MS
      if (!ready) continue

      // Захват строк: только те, что ещё pending (защита от параллельного запуска).
      const claimed = await prisma.telegramPost.updateMany({
        where: { id: { in: group.rows.map((r) => r.id) }, status: 'pending' },
        data: { status: 'sending' },
      })
      if (claimed.count !== group.rows.length) {
        // кто-то успел раньше — вернём то, что захватили, на повтор в следующем цикле
        await prisma.telegramPost.updateMany({ where: { id: { in: group.rows.map((r) => r.id) }, status: 'sending' }, data: { status: 'pending' } })
        continue
      }
      const ok = await sendChapterGroup(mangaId, group.numbers, group.rows.map((r) => r.refId))
      if (ok) posted++
    }
  } catch (err) {
    logTelegram('flushChapterPosts:', err)
  } finally {
    flushing = false
  }
  return { posted }
}

async function sendChapterGroup(mangaId: string, chapters: { id: string; number: number }[], refIds: string[]): Promise<boolean> {
  try {
    const manga = await prisma.userManga.findUnique({ where: { id: mangaId }, include: { author: true } })
    if (!manga || manga.status !== 'published') {
      await prisma.telegramPost.updateMany({ where: { kind: 'original_chapter', refId: { in: refIds } }, data: { status: 'skipped', error: 'тайтл не опубликован' } })
      return false
    }
    const cfg = telegramConfig()
    const t = TEXTS[cfg.lang]
    const sorted = [...chapters].sort((a, b) => a.number - b.number)
    const nums = sorted.map((c) => String(c.number))
    const many = sorted.length > 1
    // Одна глава — ссылка сразу на неё в читалке, несколько — на страницу тайтла.
    const url = many
      ? utm(`${cfg.siteUrl}/originals/${manga.id}`, 'originals_chapter')
      : utm(`${cfg.siteUrl}/originals/${manga.id}/read/${sorted[0].id}?read=${encodeURIComponent(manga.primaryLanguage)}`, 'originals_chapter')
    // Несколько глав: до пяти перечисляем, больше — диапазоном.
    const label = !many
      ? `${t.chapterWord} ${nums[0]}`
      : sorted.length <= 5
        ? `${t.chaptersWord} ${nums.join(', ')}`
        : `${t.chaptersWord} ${nums[0]}–${nums[nums.length - 1]} (${sorted.length})`
    const text = [
      `<b>${many ? t.newChapters : t.newChapter}</b>`,
      `<a href="${escapeHtml(url)}">${escapeHtml(manga.title)}</a> — ${escapeHtml(label)}`,
      `${t.author}: ${escapeHtml(manga.author.displayName)}`,
    ].join('\n')
    const result = await sendMessage(text)
    await markResult('original_chapter', refIds, result)
    return result.ok
  } catch (err) {
    await markResult('original_chapter', refIds, { ok: false, error: redact(err instanceof Error ? err.message : String(err)) })
    return false
  }
}

// ---------------------------------------------------------------------------
// Планировщик и повтор
// ---------------------------------------------------------------------------

let timer: NodeJS.Timeout | null = null

/** Раз в минуту отправляет созревшие главы. Ничего не делает, пока автопубликация выключена. */
export function startTelegramScheduler(): void {
  if (timer) return
  timer = setInterval(() => {
    if (isPostingEnabled()) void flushChapterPosts()
  }, 60_000)
  timer.unref?.()
  // Сразу после старта — добираем то, что накопилось, пока сервер спал.
  setTimeout(() => {
    if (isPostingEnabled()) void flushChapterPosts()
  }, 20_000).unref?.()
}

/** "Повторить" для failed (кнопка в админке). Возвращает краткий итог для UI. */
export async function retryTelegramPost(id: string): Promise<{ ok: boolean; message: string }> {
  const row = await prisma.telegramPost.findUnique({ where: { id } })
  if (!row) return { ok: false, message: 'Запись не найдена' }
  if (row.status !== 'failed') return { ok: false, message: 'Повторить можно только неудавшуюся отправку' }
  if (row.kind === 'digest') {
    // Подборка уже "ушла" целиком или не ушла; освобождаем тайтл для следующей подборки.
    await prisma.telegramPost.delete({ where: { id } })
    return { ok: true, message: 'Тайтл снова доступен для следующей подборки' }
  }
  if (!isPostingEnabled()) return { ok: false, message: 'Автопубликация выключена или не настроена' }
  if (row.kind === 'original_title') {
    await prisma.telegramPost.update({ where: { id }, data: { status: 'sending', error: null } })
    void sendTitleRow(row.refId).catch((err) => logTelegram('retry title:', err))
    return { ok: true, message: 'Отправка запущена' }
  }
  // original_chapter: возвращаем в очередь, планировщик заберёт
  await prisma.telegramPost.update({ where: { id }, data: { status: 'pending', error: null, createdAt: new Date(Date.now() - CHAPTER_DEBOUNCE_MS) } })
  void flushChapterPosts()
  return { ok: true, message: 'Поставлено в очередь' }
}
