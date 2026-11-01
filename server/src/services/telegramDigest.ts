import { randomUUID } from 'node:crypto'
import { prisma } from '../db.js'
import { mdGetJson } from './mangadexClient.js'
import {
  deleteMessage,
  escapeHtml,
  isConfigured,
  isPostingEnabled,
  logTelegram,
  redact,
  sendMediaGroup,
  sendMessage,
  telegramConfig,
} from './telegram.js'
import type { SendResult, TelegramLang } from './telegram.js'
import { TEXTS, genreLabel, pluralChapters } from './telegramTexts.js'

/*
  Подборка новинок MangaDex для Telegram-канала.

  Нагрузка на MangaDex: ОДИН запрос списка свежих тайтлов + по одному запросу
  ленты глав на язык, строго последовательно (общий ограничитель частоты
  mangadexClient), всё это кэшируется на сутки — повторный запуск подборки
  (в т.ч. тестовой) почти ничего не запрашивает.

  Отбор: есть читаемая глава (не внешняя, pages > 0) на языке постов или на
  английском; без 18+ (в запросе только safe/suggestive и ещё раз проверяем
  contentRating); тайтл ещё не попадал в подборки (TelegramPost kind=digest
  со статусом sent/skipped).

  Каждое сообщение подборки заканчивается отдельной строкой "Источник: MangaDex".
  Описания тайтлов не копируются — только название ссылкой, автор, число глав,
  жанры, языки. Обложки (только при TELEGRAM_DIGEST_COVERS=true) уходят в
  Telegram как URL с CDN MangaDex, мы их не скачиваем и не храним.
*/

const SITE_UTM = 'utm_source=telegram&utm_medium=bot&utm_campaign=digest'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LIST_LIMIT = 40
const DEFAULT_MAX_ITEMS = 12
const ENTRIES_PER_MESSAGE = 4
const TEXT_LIMIT = 4096
const CAPTION_LIMIT = 1024

// --- кэш на сутки ---------------------------------------------------------
const dayCache = new Map<string, { at: number; value: unknown }>()
function cacheGet<T>(key: string): T | undefined {
  const hit = dayCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T
  if (hit) dayCache.delete(key)
  return undefined
}
function cacheSet(key: string, value: unknown) {
  if (dayCache.size > 500) dayCache.clear()
  dayCache.set(key, { at: Date.now(), value })
}
export function clearDigestCache(): void {
  dayCache.clear()
}

// --- данные MangaDex -------------------------------------------------------
interface MdRelationship {
  id: string
  type: string
  attributes?: { name?: string; fileName?: string }
}
interface MdTag {
  id: string
  attributes: { group?: string; name?: Record<string, string> }
}
interface MdManga {
  id: string
  attributes: {
    title?: Record<string, string>
    altTitles?: Record<string, string>[]
    availableTranslatedLanguages?: string[]
    contentRating?: string
    tags?: MdTag[]
  }
  relationships?: MdRelationship[]
}

export interface DigestItem {
  id: string
  title: string
  authors: string[]
  chapters: number
  genres: string[]
  languages: string[]
  /** Ссылка на первую читаемую главу (язык постов) либо на страницу тайтла. */
  url: string
  coverUrl: string | null
}

function pickTitle(m: MdManga, lang: TelegramLang): string {
  const t = m.attributes.title ?? {}
  const alt = (m.attributes.altTitles ?? []).find((a) => a[lang])?.[lang]
  return t[lang] ?? alt ?? t.en ?? Object.values(t)[0] ?? m.id
}

async function fetchLatestTitles(lang: TelegramLang): Promise<MdManga[]> {
  const key = `list:${lang}`
  const cached = cacheGet<MdManga[]>(key)
  if (cached) return cached
  const langs = [...new Set([lang, 'en'])]
  const qs = [
    `limit=${LIST_LIMIT}`,
    'order[createdAt]=desc',
    'hasAvailableChapters=true',
    ...langs.map((l) => `availableTranslatedLanguage[]=${l}`),
    'contentRating[]=safe',
    'contentRating[]=suggestive',
    'includes[]=author',
    'includes[]=cover_art',
  ].join('&')
  const res = await mdGetJson<{ data?: MdManga[] }>(`/manga?${qs}`)
  const list = res?.data ?? []
  if (list.length > 0) cacheSet(key, list)
  return list
}

interface ChapterProbe {
  chapterId: string
  chapters: number
}

/** Первая читаемая глава на языке (null — нет читаемых глав). Результат кэшируется на сутки. */
async function probeChapters(mangaId: string, language: string): Promise<ChapterProbe | null> {
  const key = `feed:${mangaId}:${language}`
  const cached = cacheGet<ChapterProbe | null>(key)
  if (cached !== undefined) return cached
  const feed = await mdGetJson<{
    total?: number
    data?: { id: string; attributes?: { pages?: number; externalUrl?: string | null } }[]
  }>(
    `/manga/${mangaId}/feed?limit=1&translatedLanguage[]=${encodeURIComponent(language)}&contentRating[]=safe&contentRating[]=suggestive&includeExternalUrl=0&includeEmptyPages=0&includeUnavailable=0&order[chapter]=asc`,
  )
  // null от mdGetJson — это ошибка/лимит MangaDex, а не "глав нет": не кэшируем, чтобы не закрепить ошибку на сутки.
  if (!feed) return null
  const first = feed.data?.[0]
  const readable = !!first && (first.attributes?.pages ?? 0) > 0 && !first.attributes?.externalUrl
  const result: ChapterProbe | null = readable && (feed.total ?? 0) > 0 ? { chapterId: first.id, chapters: feed.total ?? 1 } : null
  cacheSet(key, result)
  return result
}

function buildItem(m: MdManga, lang: TelegramLang, readLang: string, probe: ChapterProbe, siteUrl: string): DigestItem {
  const genres = (m.attributes.tags ?? [])
    .filter((t) => t.attributes.group === 'genre')
    .map((t) => genreLabelFromTag(t, lang))
    .filter(Boolean)
    .slice(0, 3)
  const authors = [...new Set((m.relationships ?? []).filter((r) => r.type === 'author').map((r) => r.attributes?.name).filter((n): n is string => !!n))].slice(0, 2)
  const cover = (m.relationships ?? []).find((r) => r.type === 'cover_art')?.attributes?.fileName
  // Читаемая глава на языке постов — ссылка сразу в читалку; иначе (только английский) — на страницу тайтла.
  const url =
    readLang === lang
      ? `${siteUrl}/title/${m.id}/read/${probe.chapterId}?read=${encodeURIComponent(readLang)}&${SITE_UTM}`
      : `${siteUrl}/title/${m.id}?${SITE_UTM}`
  return {
    id: m.id,
    title: pickTitle(m, lang),
    authors,
    chapters: probe.chapters,
    genres,
    languages: [...new Set(m.attributes.availableTranslatedLanguages ?? [])].slice(0, 6),
    url,
    coverUrl: cover ? `https://uploads.mangadex.org/covers/${m.id}/${cover}.512.jpg` : null,
  }
}

function genreLabelFromTag(tag: MdTag, lang: TelegramLang): string {
  const curated = genreLabel(tag.id, lang)
  if (curated !== tag.id) return curated
  const names = tag.attributes.name ?? {}
  return names[lang] ?? names.en ?? Object.values(names)[0] ?? ''
}

/** Отбор тайтлов для подборки. Последовательные запросы лент глав; останавливается на max. */
export async function selectDigestItems(max = DEFAULT_MAX_ITEMS): Promise<DigestItem[]> {
  const cfg = telegramConfig()
  const lang = cfg.lang
  const list = await fetchLatestTitles(lang)
  if (list.length === 0) return []

  const used = await prisma.telegramPost.findMany({
    where: { kind: 'digest', refId: { in: list.map((m) => m.id) }, status: { in: ['sent', 'skipped'] } },
    select: { refId: true },
  })
  const usedIds = new Set(used.map((u) => u.refId))

  const items: DigestItem[] = []
  for (const m of list) {
    if (items.length >= max) break
    if (usedIds.has(m.id)) continue
    const rating = m.attributes.contentRating
    if (rating === 'erotica' || rating === 'pornographic') continue // 18+
    const available = new Set(m.attributes.availableTranslatedLanguages ?? [])
    for (const readLang of [...new Set([lang, 'en'])]) {
      if (!available.has(readLang)) continue
      const probe = await probeChapters(m.id, readLang)
      if (probe) {
        items.push(buildItem(m, lang, readLang, probe, cfg.siteUrl))
        break
      }
    }
  }
  return items
}

// --- сообщения ---------------------------------------------------------------
export interface DigestMessage {
  html: string
  photos: string[]
  itemIds: string[]
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** detail 0 — всё; 1 — без жанров; 2 — без автора. Нужно, чтобы запись влезла в подпись 1024. */
function entryHtml(n: number, item: DigestItem, lang: TelegramLang, detail: 0 | 1 | 2): string {
  const title = `<a href="${escapeHtml(item.url)}">${escapeHtml(truncate(item.title, 70))}</a>`
  const author = detail < 2 && item.authors.length ? ` — ${escapeHtml(truncate(item.authors.join(', '), 40))}` : ''
  const meta = [pluralChapters(item.chapters, lang)]
  if (detail < 1 && item.genres.length) meta.push(escapeHtml(item.genres.join(', ')))
  if (item.languages.length) meta.push(item.languages.map((l) => l.toUpperCase()).join(', '))
  return `${n}. ${title}${author}\n   ${meta.join(' · ')}`
}

/** Группирует тайтлы по сообщениям; каждое сообщение заканчивается строкой "Источник: MangaDex". */
export function composeDigestMessages(items: DigestItem[], opts: { covers: boolean; lang: TelegramLang; test?: boolean }): DigestMessage[] {
  const t = TEXTS[opts.lang]
  const messages: DigestMessage[] = []
  const limit = opts.covers ? CAPTION_LIMIT : TEXT_LIMIT
  let counter = 0

  for (let start = 0; start < items.length; start += ENTRIES_PER_MESSAGE) {
    const chunk = items.slice(start, start + ENTRIES_PER_MESSAGE)
    const head = messages.length === 0 ? `<b>${opts.test ? `${t.testDigestHeader}\n` : ''}${t.digestHeader}</b>\n\n` : ''
    const footer = `\n\n${t.source}`

    let detail: 0 | 1 | 2 = 0
    let html = ''
    for (; detail <= 2; detail = (detail + 1) as 0 | 1 | 2) {
      html = head + chunk.map((it, i) => entryHtml(counter + i + 1, it, opts.lang, detail)).join('\n\n') + footer
      if (html.length <= limit || detail === 2) break
    }
    // Крайний случай: всё равно длиннее лимита — режем записи с конца, источник остаётся.
    let use = chunk
    while (html.length > limit && use.length > 1) {
      use = use.slice(0, -1)
      html = head + use.map((it, i) => entryHtml(counter + i + 1, it, opts.lang, 2)).join('\n\n') + footer
    }
    if (html.length > limit) html = `${html.slice(0, limit - footer.length - 1)}…${footer}`

    messages.push({
      html,
      photos: opts.covers ? use.map((it) => it.coverUrl).filter((u): u is string => !!u) : [],
      itemIds: use.map((it) => it.id),
    })
    counter += use.length
    // Тайтлы, не поместившиеся в сообщение, переходят в следующее.
    if (use.length < chunk.length) start -= chunk.length - use.length
  }
  return messages
}

// --- запуск ---------------------------------------------------------------------
export interface DigestRunResult {
  ok: boolean
  skipped?: 'disabled' | 'not_configured' | 'running' | 'no_items'
  batchId?: string
  titles: number
  messages: number
  failedMessages: number
  errors: string[]
}

let running = false
export const isDigestRunning = () => running

async function sendDigestMessage(msg: DigestMessage, silent: boolean): Promise<SendResult> {
  if (msg.photos.length > 0) {
    const r = await sendMediaGroup(msg.photos, msg.html, { silent })
    if (r.ok) return r
    // Telegram не смог забрать обложку по URL — лучше текстовый список, чем ничего.
    logTelegram('album failed, fallback to text:', r.error)
  }
  return sendMessage(msg.html, { silent })
}

/**
 * Одна подборка. test=true — беззвучно и БЕЗ записи в TelegramPost (тайтлы не
 * "сгорают" для настоящих подборок), работает и при выключенном флаге
 * (достаточно токена и канала). Не бросает.
 */
export async function runDigest(opts: { test?: boolean; max?: number } = {}): Promise<DigestRunResult> {
  const test = opts.test === true
  const cfg = telegramConfig()
  const empty = (skipped: DigestRunResult['skipped']): DigestRunResult => ({ ok: false, skipped, titles: 0, messages: 0, failedMessages: 0, errors: [] })
  if (!test && !isPostingEnabled(cfg)) return empty(isConfigured(cfg) ? 'disabled' : 'not_configured')
  if (test && !isConfigured(cfg)) return empty('not_configured')
  if (running) return empty('running')

  running = true
  const result: DigestRunResult = { ok: true, titles: 0, messages: 0, failedMessages: 0, errors: [], batchId: test ? undefined : randomUUID() }
  try {
    const items = await selectDigestItems(opts.max ?? DEFAULT_MAX_ITEMS)
    if (items.length === 0) return { ...result, ok: true, skipped: 'no_items' }

    const covers = cfg.digestCovers
    const messages = composeDigestMessages(items, { covers, lang: cfg.lang, test })
    const byId = new Map(items.map((i) => [i.id, i]))

    for (const msg of messages) {
      let sent: SendResult
      try {
        sent = await sendDigestMessage(msg, test)
      } catch (err) {
        sent = { ok: false, error: redact(err instanceof Error ? err.message : String(err)) }
      }
      result.messages++
      if (sent.ok) result.titles += msg.itemIds.length
      else {
        result.failedMessages++
        result.errors.push(sent.error)
      }
      if (test) continue
      for (const id of msg.itemIds) {
        const data = sent.ok
          ? { status: 'sent', error: null, messageId: sent.messageIds[0] ?? null, messageIds: sent.messageIds }
          : { status: 'failed', error: sent.error.slice(0, 500), messageId: null, messageIds: [] }
        await prisma.telegramPost.upsert({
          where: { kind_refId: { kind: 'digest', refId: id } },
          create: { kind: 'digest', refId: id, label: byId.get(id)?.title.slice(0, 200) ?? null, batchId: result.batchId, ...data },
          update: { label: byId.get(id)?.title.slice(0, 200) ?? null, batchId: result.batchId, ...data },
        })
      }
    }
    result.ok = result.failedMessages === 0
    return result
  } catch (err) {
    logTelegram('runDigest:', err)
    return { ...result, ok: false, errors: [...result.errors, redact(err instanceof Error ? err.message : String(err))] }
  } finally {
    running = false
  }
}

/** Удаляет из канала сообщения последней (настоящей) подборки и освобождает её тайтлы. */
export async function deleteLastDigest(): Promise<{ ok: boolean; deletedMessages: number; releasedTitles: number; errors: string[] }> {
  const last = await prisma.telegramPost.findFirst({
    where: { kind: 'digest', batchId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { batchId: true },
  })
  if (!last?.batchId) return { ok: false, deletedMessages: 0, releasedTitles: 0, errors: ['Подборок для удаления нет'] }

  const rows = await prisma.telegramPost.findMany({ where: { kind: 'digest', batchId: last.batchId } })
  const messageIds = [...new Set(rows.flatMap((r) => (r.messageIds.length ? r.messageIds : r.messageId ? [r.messageId] : [])))]
  const errors: string[] = []
  let deleted = 0
  for (const id of messageIds) {
    const r = await deleteMessage(id)
    if (r.ok) deleted++
    // Уже удалено руками — для нас то же самое, что успех.
    else if (/message to delete not found/i.test(r.error)) deleted++
    else errors.push(`${id}: ${r.error}`)
  }
  if (errors.length === 0) {
    // Строки удаляем: тайтлы снова доступны для следующей подборки.
    const del = await prisma.telegramPost.deleteMany({ where: { kind: 'digest', batchId: last.batchId } })
    return { ok: true, deletedMessages: deleted, releasedTitles: del.count, errors }
  }
  return { ok: false, deletedMessages: deleted, releasedTitles: 0, errors }
}
