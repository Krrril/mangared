/*
  Общий клиент к api.mangadex.org для backend: честный User-Agent, короткий
  кэш успешных ответов, склейка одновременных одинаковых запросов и
  глобальный ограничитель частоты. Все читатели сайта ходят к MangaDex с
  одного IP этого сервера, а лимиты MangaDex — на IP (~5 запросов/с на весь
  api.mangadex.org и 40/мин на /at-home/server/{id}, см.
  https://api.mangadex.org/docs/2-limitations/), поэтому идентичные запросы
  не должны уходить наверх повторно.
*/
export const MANGADEX_BASE = 'https://api.mangadex.org'
export const USER_AGENT = 'MangaGreen/1.0 (+https://www.mangagreen.com)'

const DEFAULT_TTL_MS = 60_000
const AT_HOME_TTL_MS = 4 * 60_000
const MAX_CACHE_ENTRIES = 400
// Огромные ответы (фид на 500 глав) в кэш не кладём — чтобы он не раздувал память.
const MAX_CACHED_BODY = 300_000

export interface CacheEntry {
  status: number
  body: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<CacheEntry>>()

function ttlFor(path: string): number {
  return path.startsWith('/at-home/') ? AT_HOME_TTL_MS : DEFAULT_TTL_MS
}

function remember(key: string, entry: CacheEntry) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Map хранит порядок вставки — выбрасываем самые старые записи.
    for (const oldKey of cache.keys()) {
      cache.delete(oldKey)
      if (cache.size < MAX_CACHE_ENTRIES * 0.8) break
    }
  }
  cache.set(key, entry)
}

/*
  Ограничитель частоты запросов наверх: не чаще одного запроса в MIN_GAP_MS
  (≈4/с — с запасом под лимит в 5/с на IP). Запросы встают в очередь.
*/
const MIN_GAP_MS = 250
let nextSlotAt = 0
const MAX_QUEUE_WAIT_MS = 4000
/** false — очередь слишком длинная (перегрузка), запрос лучше отклонить, чем держать минуту. */
async function throttle(): Promise<boolean> {
  const now = Date.now()
  const at = Math.max(now, nextSlotAt)
  if (at - now > MAX_QUEUE_WAIT_MS) return false
  nextSlotAt = at + MIN_GAP_MS
  if (at > now) await new Promise((r) => setTimeout(r, at - now))
  return true
}

async function fetchUpstream(url: string): Promise<CacheEntry> {
  if (!(await throttle())) return { status: 429, body: JSON.stringify({ error: 'MangaGreen busy, retry shortly' }), expiresAt: 0 }
  const upstream = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
  const body = await upstream.text()
  return { status: upstream.status, body, expiresAt: 0 }
}

/**
 * GET к MangaDex API c кэшем и склейкой. pathWithQuery — путь с query, как он
 * есть на api.mangadex.org. fresh=true пропускает кэш (после неудачи MangaDex
 * просит запросить at-home заново, а не отдавать прежний baseUrl).
 */
export async function mdGet(pathWithQuery: string, opts: { fresh?: boolean; cacheable?: boolean } = {}): Promise<CacheEntry> {
  const url = `${MANGADEX_BASE}${pathWithQuery}`
  const fresh = opts.fresh === true
  const cacheable = opts.cacheable !== false

  const cached = cache.get(url)
  if (!fresh && cacheable && cached && cached.expiresAt > Date.now()) return cached

  let pending = fresh || !cacheable ? undefined : inFlight.get(url)
  if (!pending) {
    pending = fetchUpstream(url).finally(() => {
      if (inFlight.get(url) === pending) inFlight.delete(url)
    })
    if (!fresh && cacheable) inFlight.set(url, pending)
  }
  const entry = await pending
  if (cacheable && entry.status === 200 && entry.body.length < MAX_CACHED_BODY) {
    const path = pathWithQuery.split('?')[0]
    remember(url, { ...entry, expiresAt: Date.now() + ttlFor(path) })
  }
  return entry
}

/** mdGet + JSON.parse; null, если ответ не 200 или не JSON. */
export async function mdGetJson<T = unknown>(pathWithQuery: string, opts: { fresh?: boolean; cacheable?: boolean } = {}): Promise<T | null> {
  try {
    const entry = await mdGet(pathWithQuery, opts)
    if (entry.status !== 200) return null
    return JSON.parse(entry.body) as T
  } catch {
    return null
  }
}
