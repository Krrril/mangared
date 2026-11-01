import { mdGetJson, USER_AGENT } from './mangadexClient.js'

/*
  "Рабочие" языки тайтла MangaDex — только те, на которых есть реально
  читаемая глава (не внешняя, не пустая, не недоступная), а сама самая свежая
  глава языка открывается: at-home отдаёт страницы и первая картинка грузится
  (с узла сети или с оригинального сервера). availableTranslatedLanguages у
  MangaDex этого не гарантирует — там бывают языки, где есть только ссылки на
  сторонние сайты. Результат кэшируется на 12 часов, проверка картинки идёт
  в фоне и не задерживает ответ.
*/
const CACHE_TTL_MS = 12 * 60 * 60_000
const MAX_TITLES = 1500
const MAX_LANGUAGES = 40
const CONCURRENCY = 3
const CONTENT_RATINGS = 'contentRating[]=safe&contentRating[]=suggestive'

export interface WorkingLanguage {
  code: string
  /** Число читаемых глав на этом языке */
  chapters: number
}

interface TitleEntry {
  languages: WorkingLanguage[]
  expiresAt: number
  /** Языки, у которых глубокая проверка (at-home + картинка) показала, что глава не открывается */
  broken: Set<string>
}

const titles = new Map<string, TitleEntry>()
const inFlight = new Map<string, Promise<TitleEntry>>()

// --- Репорты читателей "язык не открывается" ---
const PROBLEM_TTL_MS = 24 * 60 * 60_000
/** Столько разных читателей (IP) должны пожаловаться, чтобы язык скрылся для всех. */
const PROBLEM_THRESHOLD = 2
const problems = new Map<string, { reporters: Set<string>; until: number }>()

export function reportLanguageProblem(mangaId: string, language: string, reporter: string): void {
  const key = `${mangaId}|${language}`
  const now = Date.now()
  const cur = problems.get(key)
  if (!cur || cur.until < now) {
    problems.set(key, { reporters: new Set([reporter]), until: now + PROBLEM_TTL_MS })
  } else {
    cur.reporters.add(reporter)
  }
  if (problems.size > 5000) {
    for (const [k, v] of problems) if (v.until < now) problems.delete(k)
  }
}

function isReportedBroken(mangaId: string, language: string): boolean {
  const cur = problems.get(`${mangaId}|${language}`)
  return !!cur && cur.until > Date.now() && cur.reporters.size >= PROBLEM_THRESHOLD
}

// --- Проверка картинки ---
// at-home ограничен 40 запросов/мин на IP и им пользуются сами читатели —
// для проверок тратим не больше половины.
const PROBE_BUDGET_PER_MIN = 15
let probeWindowStart = 0
let probeUsed = 0
function takeProbeBudget(): boolean {
  const now = Date.now()
  if (now - probeWindowStart > 60_000) {
    probeWindowStart = now
    probeUsed = 0
  }
  if (probeUsed >= PROBE_BUDGET_PER_MIN) return false
  probeUsed += 1
  return true
}

async function imageReachable(url: string): Promise<boolean> {
  try {
    // Range — чтобы не тянуть многомегабайтную страницу целиком ради проверки.
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(8000) })
    const ok = (res.status === 200 || res.status === 206) && (res.headers.get('content-type') ?? '').startsWith('image/')
    await res.body?.cancel().catch(() => {})
    return ok
  } catch {
    return false
  }
}

interface AtHome {
  baseUrl: string
  chapter: { hash: string; data: string[]; dataSaver: string[] }
}

/** true — глава открывается (или проверить не удалось — тогда не наказываем язык). */
async function probeChapter(chapterId: string): Promise<boolean> {
  if (!takeProbeBudget()) return true
  const ah = await mdGetJson<AtHome>(`/at-home/server/${chapterId}`)
  if (!ah) return true
  const file = ah.chapter.data[0]
  const saver = ah.chapter.dataSaver[0]
  if (!file) return false
  if (await imageReachable(`${ah.baseUrl}/data/${ah.chapter.hash}/${file}`)) return true
  if (await imageReachable(`https://uploads.mangadex.org/data/${ah.chapter.hash}/${file}`)) return true
  if (saver && (await imageReachable(`https://uploads.mangadex.org/data-saver/${ah.chapter.hash}/${saver}`))) return true
  return false
}

// --- Основная логика ---
interface MangaResponse {
  data?: { attributes?: { availableTranslatedLanguages?: string[] } }
}
interface FeedResponse {
  total?: number
  data?: { id: string }[]
}

async function checkLanguage(mangaId: string, language: string): Promise<{ working?: WorkingLanguage; latestChapterId?: string }> {
  const feed = await mdGetJson<FeedResponse>(
    `/manga/${mangaId}/feed?limit=1&translatedLanguage[]=${encodeURIComponent(language)}&${CONTENT_RATINGS}&includeExternalUrl=0&includeEmptyPages=0&includeUnavailable=0&order[readableAt]=desc`,
  )
  const total = feed?.total ?? 0
  if (total <= 0) return {}
  return { working: { code: language, chapters: total }, latestChapterId: feed?.data?.[0]?.id }
}

async function buildEntry(mangaId: string): Promise<TitleEntry> {
  const manga = await mdGetJson<MangaResponse>(`/manga/${mangaId}`)
  const available = [...new Set(manga?.data?.attributes?.availableTranslatedLanguages ?? [])].slice(0, MAX_LANGUAGES)

  const found: { working: WorkingLanguage; latestChapterId?: string }[] = []
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, available.length) }, async () => {
      while (cursor < available.length) {
        const language = available[cursor++]
        const res = await checkLanguage(mangaId, language)
        if (res.working) found.push({ working: res.working, latestChapterId: res.latestChapterId })
      }
    }),
  )

  const entry: TitleEntry = {
    languages: found.map((f) => f.working).sort((a, b) => a.code.localeCompare(b.code)),
    // Не удалось получить сам тайтл (сбой MangaDex) — пустой результат не запоминаем надолго.
    expiresAt: Date.now() + (manga ? CACHE_TTL_MS : 60_000),
    broken: new Set(),
  }

  // Глубокая проверка — в фоне, ответ читателю не задерживает; её итог
  // сказывается на следующих показах (и на этом кэше).
  void (async () => {
    for (const f of found) {
      if (!f.latestChapterId) continue
      const ok = await probeChapter(f.latestChapterId)
      if (!ok) entry.broken.add(f.working.code)
    }
  })()

  return entry
}

/** Рабочие языки тайтла (без языков, помеченных проблемными). */
export async function getWorkingLanguages(mangaId: string): Promise<WorkingLanguage[]> {
  let entry = titles.get(mangaId)
  if (!entry || entry.expiresAt < Date.now()) {
    let pending = inFlight.get(mangaId)
    if (!pending) {
      pending = buildEntry(mangaId).finally(() => inFlight.delete(mangaId))
      inFlight.set(mangaId, pending)
    }
    entry = await pending
    if (titles.size >= MAX_TITLES) {
      const oldest = titles.keys().next().value
      if (oldest !== undefined) titles.delete(oldest)
    }
    titles.set(mangaId, entry)
  }
  return entry.languages.filter((l) => !entry!.broken.has(l.code) && !isReportedBroken(mangaId, l.code))
}

// ---------------------------------------------------------------------------
// Быстрая проверка "есть ли читаемая глава" для фильтра списков (каталог,
// главная, поиск, Random Pick). Читаемая = не внешняя (includeExternalUrl=0),
// pages > 0 (includeEmptyPages=0), доступная (includeUnavailable=0) — те же
// условия ленты глав, что и в checkLanguage выше. В отличие от
// getWorkingLanguages здесь НЕТ перебора всех языков и глубокой проверки
// картинки: языки проверяются по порядку, который прислал клиент, и
// проверка останавливается на первом, где глава есть. Если полный разбор
// тайтла уже лежит в кэше getWorkingLanguages — берём ответ из него.
//
// Нагрузка на MangaDex: ВСЕ проверки идут ОДНОЙ очередью, строго
// последовательно (поверх общего ограничителя mangadexClient), результат
// кэшируется на 12 часов (есть читаемая глава) / 6 часов (нет). Бюджет на
// клиента — не больше READABLE_BUDGET_PER_MIN непроверенных тайтлов в минуту.
// Если проверить не вышло (сбой MangaDex, дедлайн, лимит) — null: клиент
// тайтл НЕ скрывает (лучше показать лишнее, чем пустую страницу).
// ---------------------------------------------------------------------------
const READABLE_TTL_YES_MS = 12 * 60 * 60_000
const READABLE_TTL_NO_MS = 6 * 60 * 60_000
const MAX_READABLE_ENTRIES = 5000
const READABLE_BUDGET_PER_MIN = 80
const MAX_LANGS_PER_ITEM = 6

const readableCache = new Map<string, { value: boolean; expiresAt: number }>()
const readableInFlight = new Map<string, Promise<boolean | null>>()
let readableQueue: Promise<unknown> = Promise.resolve()

export interface ReadableItem {
  id: string
  /** Языки по порядку проверки (первый — самый желательный). */
  languages: string[]
}

/** true — есть читаемая глава на языке; false — нет; null — проверить не удалось. */
async function feedHasReadable(mangaId: string, language: string): Promise<boolean | null> {
  const feed = await mdGetJson<FeedResponse>(
    `/manga/${mangaId}/feed?limit=1&translatedLanguage[]=${encodeURIComponent(language)}&${CONTENT_RATINGS}&includeExternalUrl=0&includeEmptyPages=0&includeUnavailable=0&order[readableAt]=desc`,
  )
  if (!feed) return null
  return (feed.total ?? 0) > 0
}

async function resolveReadable(item: ReadableItem): Promise<boolean | null> {
  const full = titles.get(item.id)
  if (full && full.expiresAt > Date.now()) return full.languages.some((l) => !full.broken.has(l.code))

  let sawError = false
  for (const language of item.languages.slice(0, MAX_LANGS_PER_ITEM)) {
    const has = await feedHasReadable(item.id, language)
    if (has === true) return true
    if (has === null) sawError = true
  }
  // Хотя бы один языковой запрос упал — не утверждаем "нет глав".
  return sawError ? null : false
}

function rememberReadable(id: string, value: boolean): void {
  if (readableCache.size >= MAX_READABLE_ENTRIES) {
    const oldest = readableCache.keys().next().value
    if (oldest !== undefined) readableCache.delete(oldest)
  }
  readableCache.set(id, { value, expiresAt: Date.now() + (value ? READABLE_TTL_YES_MS : READABLE_TTL_NO_MS) })
}

function enqueueReadable(item: ReadableItem): Promise<boolean | null> {
  let pending = readableInFlight.get(item.id)
  if (pending) return pending
  // Строго по одному: следующая проверка начинается после предыдущей.
  const run = readableQueue.then(() => resolveReadable(item))
  readableQueue = run.catch(() => undefined)
  pending = run
    .then((value) => {
      if (value !== null) rememberReadable(item.id, value)
      return value
    })
    .catch(() => null)
    .finally(() => readableInFlight.delete(item.id))
  readableInFlight.set(item.id, pending)
  return pending
}

const clientReadableUsage = new Map<string, { count: number; resetAt: number }>()
function takeReadableBudget(clientKey: string, n: number): boolean {
  const now = Date.now()
  if (clientReadableUsage.size > 2000) {
    for (const [k, v] of clientReadableUsage) if (v.resetAt <= now) clientReadableUsage.delete(k)
  }
  const cur = clientReadableUsage.get(clientKey)
  if (!cur || cur.resetAt <= now) {
    clientReadableUsage.set(clientKey, { count: n, resetAt: now + 60_000 })
    return n <= READABLE_BUDGET_PER_MIN
  }
  if (cur.count + n > READABLE_BUDGET_PER_MIN) return false
  cur.count += n
  return true
}

/**
 * Читаемость тайтлов пачкой. Ответ ждёт не дольше deadlineMs: что не
 * успело — null (проверка продолжается в фоне и ляжет в кэш для следующего
 * запроса). Тайтлы, уже лежащие в кэше, отвечают мгновенно.
 */
export async function checkReadable(items: ReadableItem[], clientKey: string, deadlineMs = 3500): Promise<Record<string, boolean | null>> {
  const result: Record<string, boolean | null> = {}
  const need: ReadableItem[] = []
  for (const item of items) {
    const cached = readableCache.get(item.id)
    if (cached && cached.expiresAt > Date.now()) {
      result[item.id] = cached.value
      continue
    }
    const full = titles.get(item.id)
    if (full && full.expiresAt > Date.now()) {
      result[item.id] = full.languages.some((l) => !full.broken.has(l.code))
      continue
    }
    need.push(item)
  }
  if (need.length === 0) return result

  // Бюджет тратят только тайтлы, которых ещё нет в работе.
  const fresh = need.filter((i) => !readableInFlight.has(i.id))
  const allowed = fresh.length === 0 || takeReadableBudget(clientKey, fresh.length)
  const toRun = allowed ? need : need.filter((i) => readableInFlight.has(i.id))
  for (const i of need) result[i.id] = null

  const timeout = new Promise<void>((r) => setTimeout(r, deadlineMs))
  await Promise.race([
    Promise.all(
      toRun.map(async (i) => {
        result[i.id] = await enqueueReadable(i)
      }),
    ),
    timeout,
  ])
  // Что не успело к дедлайну, осталось null; его проверка продолжается в фоне.
  return { ...result }
}
