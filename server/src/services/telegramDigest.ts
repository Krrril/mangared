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
  английском; ТОЛЬКО рейтинг safe и без тегов из DIGEST_EXCLUDED_TAGS
  (doujinshi) — это фильтр безопасности: он и в запросе к MangaDex
  (contentRating[]=safe, excludedTags[]), и повторная проверка каждого
  полученного тайтла; тайтл ещё не попадал в подборки (TelegramPost
  kind=digest со статусом sent/skipped). Если после фильтров набралось меньше
  MIN_ITEMS тайтлов, подгружается следующая порция списка (не более
  MAX_EXTRA_PAGES раз).

  Каждое сообщение подборки заканчивается отдельной строкой "Источник: MangaDex".
  Описания тайтлов не копируются — только название ссылкой, автор, число глав,
  жанры, языки. Обложки (только при TELEGRAM_DIGEST_COVERS=true) уходят в
  Telegram как URL НАШЕГО прокси обложек (<сайт>/covers/<id>/<файл>.512.jpg, см.
  api/cover.ts): CDN MangaDex отдаёт Telegram 403 (защита от хотлинка). Мы их
  не храним; перед отправкой сервер сам запрашивает каждую обложку через
  прокси (проверка 200 / image/jpeg / до 5 МБ + прогрев кэша Vercel, чтобы
  Telegram не ждал холодный запуск функции).
*/

const SITE_UTM = 'utm_source=telegram&utm_medium=bot&utm_campaign=digest'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const LIST_LIMIT = 40
const DEFAULT_MAX_ITEMS = 12
const ENTRIES_PER_MESSAGE = 4
const TEXT_LIMIT = 4096
const CAPTION_LIMIT = 1024
/** Фильтр безопасности: в подборку идёт только этот рейтинг контента. */
export const DIGEST_ALLOWED_RATING = 'safe'
/** Теги MangaDex, тайтлы с которыми в подборку не попадают (id тега → метка для статистики). */
export const DIGEST_EXCLUDED_TAGS: readonly { id: string; label: 'doujinshi' }[] = [{ id: 'b13b2a48-c720-44a9-9c77-39c9979373fb', label: 'doujinshi' }]
/** Если после фильтров тайтлов меньше — загружаем следующую порцию списка (не более MAX_EXTRA_PAGES раз). */
const MIN_ITEMS = 8
const MAX_EXTRA_PAGES = 4
/** Telegram принимает фото по URL до 5 МБ. */
const COVER_MAX_BYTES = 5 * 1024 * 1024
const COVER_TIMEOUT_MS = 20_000
const COVER_CONCURRENCY = 3
/** Имя файла обложки, которое принимает прокси (белый список api/cover.ts). */
const COVER_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|gif|webp)$/i
const MANGA_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  /** Рейтинг контента и теги MangaDex (для проверки фильтра безопасности). */
  rating: string
  tags: string[]
  /** Почему обложка не пошла в альбом (проверка через прокси не прошла); для TelegramPost.error. */
  coverProblem?: string
}

function pickTitle(m: MdManga, lang: TelegramLang): string {
  const t = m.attributes.title ?? {}
  const alt = (m.attributes.altTitles ?? []).find((a) => a[lang])?.[lang]
  return t[lang] ?? alt ?? t.en ?? Object.values(t)[0] ?? m.id
}

async function fetchLatestTitles(lang: TelegramLang, offset: number): Promise<MdManga[]> {
  const key = `list:${lang}:${offset}`
  const cached = cacheGet<MdManga[]>(key)
  if (cached) return cached
  const langs = [...new Set([lang, 'en'])]
  const qs = [
    `limit=${LIST_LIMIT}`,
    ...(offset > 0 ? [`offset=${offset}`] : []),
    'order[createdAt]=desc',
    'hasAvailableChapters=true',
    ...langs.map((l) => `availableTranslatedLanguage[]=${l}`),
    `contentRating[]=${DIGEST_ALLOWED_RATING}`,
    ...DIGEST_EXCLUDED_TAGS.map((t) => `excludedTags[]=${t.id}`),
    'excludedTagsMode=OR',
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
    `/manga/${mangaId}/feed?limit=1&translatedLanguage[]=${encodeURIComponent(language)}&contentRating[]=safe&includeExternalUrl=0&includeEmptyPages=0&includeUnavailable=0&order[chapter]=asc`,
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
    rating: m.attributes.contentRating ?? 'unknown',
    tags: (m.attributes.tags ?? []).map((t) => t.attributes.name?.en ?? t.id),
    coverUrl: cover && MANGA_ID_RE.test(m.id) && COVER_FILE_RE.test(cover) ? `${siteUrl}/covers/${m.id}/${cover}.512.jpg` : null,
  }
}

function genreLabelFromTag(tag: MdTag, lang: TelegramLang): string {
  const curated = genreLabel(tag.id, lang)
  if (curated !== tag.id) return curated
  const names = tag.attributes.name ?? {}
  return names[lang] ?? names.en ?? Object.values(names)[0] ?? ''
}

export interface DigestFilterStats {
  /** Сколько порций списка загружено (1 + дозагрузки). */
  pages: number
  /** Сколько тайтлов просмотрено. */
  checked: number
  /** Сколько исключено (сумма причин). */
  excluded: number
  /** Сколько попало в подборку. */
  selected: number
  reasons: {
    doujinshi: number
    suggestive: number
    erotica: number
    pornographic: number
    /** Рейтинг не safe и не из перечисленных (в т.ч. не указан). */
    otherRating: number
    alreadyPosted: number
    noReadableChapter: number
  }
}

const emptyStats = (): DigestFilterStats => ({
  pages: 0,
  checked: 0,
  excluded: 0,
  selected: 0,
  reasons: { doujinshi: 0, suggestive: 0, erotica: 0, pornographic: 0, otherRating: 0, alreadyPosted: 0, noReadableChapter: 0 },
})

/**
 * Причина, по которой тайтл нельзя в подборку по соображениям безопасности
 * (рейтинг не safe или запрещённый тег), либо null. Проверка повторяет запрос
 * к MangaDex: фильтры в запросе — основной барьер, это — страховка.
 */
export function safetyRejection(m: MdManga): keyof DigestFilterStats['reasons'] | null {
  const rating = m.attributes.contentRating
  if (rating !== DIGEST_ALLOWED_RATING) {
    return rating === 'suggestive' || rating === 'erotica' || rating === 'pornographic' ? rating : 'otherRating'
  }
  const tagIds = new Set((m.attributes.tags ?? []).map((t) => t.id))
  for (const t of DIGEST_EXCLUDED_TAGS) if (tagIds.has(t.id)) return t.label
  return null
}

let lastFilter: (DigestFilterStats & { at: string }) | null = null
/** Итог последнего отбора (в памяти процесса: после перезапуска сервера пусто). */
export const getLastDigestFilter = () => lastFilter

/**
 * Отбор тайтлов для подборки. Последовательные запросы лент глав; останавливается на max.
 * Если после фильтров меньше MIN_ITEMS — подгружает следующую порцию списка (до MAX_EXTRA_PAGES раз).
 */
export async function selectDigest(max = DEFAULT_MAX_ITEMS): Promise<{ items: DigestItem[]; stats: DigestFilterStats }> {
  const cfg = telegramConfig()
  const lang = cfg.lang
  const stats = emptyStats()
  const items: DigestItem[] = []
  const seen = new Set<string>()

  for (let page = 0; page <= MAX_EXTRA_PAGES; page++) {
    const list = await fetchLatestTitles(lang, page * LIST_LIMIT)
    if (list.length === 0) break
    stats.pages++

    const used = await prisma.telegramPost.findMany({
      where: { kind: 'digest', refId: { in: list.map((m) => m.id) }, status: { in: ['sent', 'skipped'] } },
      select: { refId: true },
    })
    const usedIds = new Set(used.map((u) => u.refId))

    for (const m of list) {
      if (items.length >= max) break
      if (seen.has(m.id)) continue
      seen.add(m.id)
      stats.checked++
      const unsafe = safetyRejection(m)
      if (unsafe) {
        stats.reasons[unsafe]++
        continue
      }
      if (usedIds.has(m.id)) {
        stats.reasons.alreadyPosted++
        continue
      }
      const available = new Set(m.attributes.availableTranslatedLanguages ?? [])
      let added = false
      for (const readLang of [...new Set([lang, 'en'])]) {
        if (!available.has(readLang)) continue
        const probe = await probeChapters(m.id, readLang)
        if (probe) {
          items.push(buildItem(m, lang, readLang, probe, cfg.siteUrl))
          added = true
          break
        }
      }
      if (!added) stats.reasons.noReadableChapter++
    }

    if (items.length >= Math.min(MIN_ITEMS, max) || list.length < LIST_LIMIT) break
  }

  stats.selected = items.length
  stats.excluded = Object.values(stats.reasons).reduce((a, b) => a + b, 0)
  return { items, stats }
}

export async function selectDigestItems(max = DEFAULT_MAX_ITEMS): Promise<DigestItem[]> {
  return (await selectDigest(max)).items
}

// --- проверка и прогрев обложек --------------------------------------------------
/**
 * Одна обложка через наш прокси: 200, image/jpeg, не больше 5 МБ. Запрос GET
 * (не HEAD) и тело дочитывается до конца: так обложка заодно попадает в кэш
 * Vercel, и Telegram получает её уже с края сети. Возвращает null при успехе
 * или текст причины.
 */
export async function checkCover(url: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), COVER_TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { method: 'GET', headers: { accept: 'image/jpeg,image/*' }, signal: controller.signal })
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => {})
      return `HTTP ${res.status}`
    }
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (type !== 'image/jpeg') {
      await res.body?.cancel().catch(() => {})
      return `тип ${type || 'не указан'}, нужен image/jpeg`
    }
    const declared = Number(res.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > COVER_MAX_BYTES) {
      await res.body?.cancel().catch(() => {})
      return `размер ${declared} байт больше 5 МБ`
    }
    // Тело читаем потоком: считаем байты и обрываем, если больше лимита.
    let total = 0
    const reader = res.body?.getReader()
    if (!reader) return 'пустой ответ'
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > COVER_MAX_BYTES) {
        await reader.cancel().catch(() => {})
        return 'размер больше 5 МБ'
      }
    }
    return total === 0 ? 'пустой ответ' : null
  } catch (err) {
    return err instanceof Error && err.name === 'AbortError' ? `таймаут ${COVER_TIMEOUT_MS / 1000} с` : `сеть: ${redact(err instanceof Error ? err.message : String(err))}`
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Проверяет и прогревает обложки подборки (по COVER_CONCURRENCY одновременно,
 * чтобы не устраивать всплеск на прокси и MangaDex). Неудачные получают
 * coverUrl=null и причину в coverProblem — остальные не страдают.
 */
export async function verifyDigestCovers(items: DigestItem[], fetchImpl: typeof fetch = fetch): Promise<void> {
  const queue = items.filter((i) => i.coverUrl)
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      const problem = await checkCover(it.coverUrl!, fetchImpl)
      if (problem) {
        logTelegram(`обложка ${it.id} не прошла проверку: ${problem}`)
        it.coverProblem = problem
        it.coverUrl = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(COVER_CONCURRENCY, queue.length) }, worker))
}

// --- сообщения ---------------------------------------------------------------
export interface DigestMessage {
  html: string
  photos: string[]
  itemIds: string[]
  /** Причины, по которым обложки отдельных тайтлов не пошли в альбом. */
  coverProblems: { id: string; problem: string }[]
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
  let counter = 0

  for (let start = 0; start < items.length; start += ENTRIES_PER_MESSAGE) {
    const chunk = items.slice(start, start + ENTRIES_PER_MESSAGE)
    const head = messages.length === 0 ? `<b>${opts.test ? `${t.testDigestHeader}\n` : ''}${t.digestHeader}</b>\n\n` : ''
    const footer = `\n\n${t.source}`
    // Подпись к фото — до 1024 символов; сообщение без единой обложки (в т.ч. при
    // TELEGRAM_DIGEST_COVERS=false или когда все обложки не прошли проверку) — обычный текст до 4096.
    const limit = opts.covers && chunk.some((it) => it.coverUrl) ? CAPTION_LIMIT : TEXT_LIMIT

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
      coverProblems: opts.covers ? use.filter((it) => it.coverProblem).map((it) => ({ id: it.id, problem: it.coverProblem! })) : [],
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
  /** Итог отбора: сколько просмотрено/исключено и по каким причинам. */
  filter?: DigestFilterStats
  /** Не ошибки отправки, а замечания: обложки, не прошедшие проверку, альбом, ушедший текстом. */
  warnings: string[]
}

let running = false
export const isDigestRunning = () => running

/**
 * Альбом (2+ обложки) или одно фото; без обложек — текст. Если Telegram отверг
 * картинки (WEBPAGE_MEDIA_EMPTY, WEBPAGE_CURL_FAILED, "failed to get HTTP URL
 * content" и т.п.), тот же текст уходит без картинок, а причина возвращается в
 * albumError — её пишем в TelegramPost.error, чтобы было видно в админке.
 */
async function sendDigestMessage(msg: DigestMessage, silent: boolean): Promise<{ sent: SendResult; albumError?: string }> {
  let albumError: string | undefined
  if (msg.photos.length > 0) {
    const r = await sendMediaGroup(msg.photos, msg.html, { silent })
    if (r.ok) return { sent: r }
    albumError = r.error
    logTelegram('album failed, fallback to text:', r.error)
  }
  // Текст без картинок может быть длиннее подписи — это допустимо (лимит 4096, а html уже ≤ 1024).
  return { sent: await sendMessage(msg.html, { silent }), albumError }
}

/** Причина для TelegramPost.error у успешно отправленного (текстом) тайтла. */
function sentNote(msg: DigestMessage, id: string, albumError?: string): string | null {
  const parts: string[] = []
  const cover = msg.coverProblems.find((p) => p.id === id)
  if (cover) parts.push(`обложка не прошла проверку: ${cover.problem}`)
  if (albumError) parts.push(`альбом не отправился, ушёл текстом без картинок: ${albumError}`)
  return parts.length ? parts.join('; ').slice(0, 500) : null
}

/**
 * Одна подборка. test=true — беззвучно и БЕЗ записи в TelegramPost (тайтлы не
 * "сгорают" для настоящих подборок), работает и при выключенном флаге
 * (достаточно токена и канала). Не бросает.
 */
export async function runDigest(opts: { test?: boolean; max?: number } = {}): Promise<DigestRunResult> {
  const test = opts.test === true
  const cfg = telegramConfig()
  const empty = (skipped: DigestRunResult['skipped']): DigestRunResult => ({ ok: false, skipped, titles: 0, messages: 0, failedMessages: 0, errors: [], warnings: [] })
  if (!test && !isPostingEnabled(cfg)) return empty(isConfigured(cfg) ? 'disabled' : 'not_configured')
  if (test && !isConfigured(cfg)) return empty('not_configured')
  if (running) return empty('running')

  running = true
  const result: DigestRunResult = { ok: true, titles: 0, messages: 0, failedMessages: 0, errors: [], warnings: [], batchId: test ? undefined : randomUUID() }
  try {
    const { items, stats } = await selectDigest(opts.max ?? DEFAULT_MAX_ITEMS)
    result.filter = stats
    lastFilter = { ...stats, at: new Date().toISOString() }
    if (items.length === 0) return { ...result, ok: true, skipped: 'no_items' }

    const covers = cfg.digestCovers
    if (covers) await verifyDigestCovers(items)
    const messages = composeDigestMessages(items, { covers, lang: cfg.lang, test })
    const byId = new Map(items.map((i) => [i.id, i]))

    for (const msg of messages) {
      let sent: SendResult
      let albumError: string | undefined
      try {
        ;({ sent, albumError } = await sendDigestMessage(msg, test))
      } catch (err) {
        sent = { ok: false, error: redact(err instanceof Error ? err.message : String(err)) }
      }
      result.messages++
      for (const p of msg.coverProblems) result.warnings.push(`обложка ${p.id}: ${p.problem}`)
      if (albumError && sent.ok) result.warnings.push(`альбом: ${albumError}`)
      if (sent.ok) result.titles += msg.itemIds.length
      else {
        result.failedMessages++
        result.errors.push(sent.error)
      }
      if (test) continue
      for (const id of msg.itemIds) {
        const data = sent.ok
          ? { status: 'sent', error: sentNote(msg, id, albumError), messageId: sent.messageIds[0] ?? null, messageIds: sent.messageIds }
          : { status: 'failed', error: [sentNote(msg, id, albumError), sent.error].filter(Boolean).join('; ').slice(0, 500), messageId: null, messageIds: [] }
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
