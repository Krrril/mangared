/*
  Общий клиент к api.mangadex.org для backend: честный User-Agent, короткий
  кэш успешных ответов, склейка одновременных одинаковых запросов и
  глобальный ограничитель частоты. Все читатели сайта ходят к MangaDex с
  одного IP этого сервера, а лимиты MangaDex — на IP (~5 запросов/с на весь
  api.mangadex.org и 40/мин на /at-home/server/{id}, см.
  https://api.mangadex.org/docs/2-limitations/), поэтому идентичные запросы
  не должны уходить наверх повторно.

  Устойчивость к перегрузке (боты, скрейперы, всплески):
    - БЮДЖЕТ НА КЛИЕНТА: каждый клиент (IP из заголовков, см. routes/
      mangadex.ts) может вызвать не больше CLIENT_BUDGET_PER_MIN запросов
      НАВЕРХ в минуту. Попадания в кэш и склейка бюджет не тратят. Без этого
      один скрейпер с уникальными query (offset/фильтры) занимал общую
      очередь (≈4 запроса/с на весь сайт) целиком, и каталог переставал
      грузиться у всех остальных.
    - STALE-IF-ERROR: просроченный, но не старше STALE_MAX_MS ответ отдаётся,
      если MangaDex ответил 429/5xx, не ответил вовсе или наша очередь
      переполнена — каталог и страницы тайтлов остаются доступными, пока
      MangaDex/мы под нагрузкой.
*/
export const MANGADEX_BASE = 'https://api.mangadex.org'
export const USER_AGENT = 'MangaGreen/1.0 (+https://www.mangagreen.com)'

const DEFAULT_TTL_MS = 2 * 60_000
const AT_HOME_TTL_MS = 4 * 60_000
// Сколько после истечения TTL запись ещё годится как "запасной" ответ при ошибке.
const STALE_MAX_MS = 30 * 60_000
const MAX_CACHE_ENTRIES = 400
// Огромные ответы (фид на 500 глав) в кэш не кладём — чтобы он не раздувал память.
const MAX_CACHED_BODY = 300_000

const MIN_GAP_MS = Number(process.env.MANGADEX_MIN_GAP_MS ?? 250)
const MAX_QUEUE_WAIT_MS = 4000
const CLIENT_BUDGET_PER_MIN = Number(process.env.MANGADEX_CLIENT_BUDGET ?? 90)
const CLIENT_WINDOW_MS = 60_000

export interface CacheEntry {
  status: number
  body: string
  /** До этого момента ответ свежий; после — только как stale при ошибке. */
  expiresAt: number
  /** true — отдан просроченный ответ вместо ошибки (для заголовка x-cache). */
  stale?: boolean
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
  cache.delete(key) // переставляем в конец порядка вставки
  cache.set(key, entry)
}

/*
  Ограничитель частоты запросов наверх: не чаще одного запроса в MIN_GAP_MS
  (≈4/с — с запасом под лимит в 5/с на IP). Запросы встают в очередь.
*/
let nextSlotAt = 0
/** false — очередь слишком длинная (перегрузка), запрос лучше отклонить, чем держать минуту. */
async function throttle(): Promise<boolean> {
  const now = Date.now()
  const at = Math.max(now, nextSlotAt)
  if (at - now > MAX_QUEUE_WAIT_MS) return false
  nextSlotAt = at + MIN_GAP_MS
  if (at > now) await new Promise((r) => setTimeout(r, at - now))
  return true
}

// --- бюджет на клиента -------------------------------------------------
const clientUsage = new Map<string, { count: number; resetAt: number }>()
let lastClientSweep = 0

/** true — запрос наверх разрешён и записан на клиента. */
function takeClientBudget(clientKey: string): boolean {
  const now = Date.now()
  if (now - lastClientSweep > CLIENT_WINDOW_MS) {
    lastClientSweep = now
    for (const [k, v] of clientUsage) if (v.resetAt <= now) clientUsage.delete(k)
  }
  const usage = clientUsage.get(clientKey)
  if (!usage || usage.resetAt <= now) {
    clientUsage.set(clientKey, { count: 1, resetAt: now + CLIENT_WINDOW_MS })
    return true
  }
  if (usage.count >= CLIENT_BUDGET_PER_MIN) return false
  usage.count++
  return true
}

const busyEntry = (message: string): CacheEntry => ({ status: 429, body: JSON.stringify({ error: message }), expiresAt: 0 })

async function fetchUpstream(url: string): Promise<CacheEntry> {
  if (!(await throttle())) return busyEntry('MangaGreen busy, retry shortly')
  const upstream = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
  const body = await upstream.text()
  return { status: upstream.status, body, expiresAt: 0 }
}

/** Ответ из кэша, который можно отдать вместо ошибки (не старше STALE_MAX_MS), либо undefined. */
function staleFor(url: string): CacheEntry | undefined {
  const e = cache.get(url)
  if (e && e.status === 200 && Date.now() - e.expiresAt < STALE_MAX_MS) return { ...e, stale: true }
  return undefined
}

/**
 * GET к MangaDex API c кэшем и склейкой. pathWithQuery — путь с query, как он
 * есть на api.mangadex.org. fresh=true пропускает кэш (после неудачи MangaDex
 * просит запросить at-home заново, а не отдавать прежний baseUrl).
 * clientKey — кто просит (для бюджета на клиента); без него бюджет не применяется
 * (внутренние вызовы сервера).
 */
export async function mdGet(
  pathWithQuery: string,
  opts: { fresh?: boolean; cacheable?: boolean; clientKey?: string } = {},
): Promise<CacheEntry> {
  const url = `${MANGADEX_BASE}${pathWithQuery}`
  const fresh = opts.fresh === true
  const cacheable = opts.cacheable !== false

  const cached = cache.get(url)
  if (!fresh && cacheable && cached && cached.expiresAt > Date.now()) return cached

  let pending = fresh || !cacheable ? undefined : inFlight.get(url)
  if (!pending) {
    // Идём наверх: это единственное место, где тратится бюджет клиента и
    // общая очередь. Исчерпавший бюджет получает stale (если есть) или 429.
    if (opts.clientKey && !takeClientBudget(opts.clientKey)) {
      return (cacheable && staleFor(url)) || busyEntry('Too many requests, slow down')
    }
    pending = fetchUpstream(url).finally(() => {
      if (inFlight.get(url) === pending) inFlight.delete(url)
    })
    if (!fresh && cacheable) inFlight.set(url, pending)
  }

  let entry: CacheEntry
  try {
    entry = await pending
  } catch (err) {
    // Сеть/таймаут: лучше отдать запасной ответ, чем 502.
    const stale = cacheable ? staleFor(url) : undefined
    if (stale) return stale
    throw err
  }

  if (cacheable && entry.status === 200 && entry.body.length < MAX_CACHED_BODY) {
    const path = pathWithQuery.split('?')[0]
    remember(url, { ...entry, expiresAt: Date.now() + ttlFor(path) })
    return entry
  }
  if (cacheable && (entry.status === 429 || entry.status >= 500)) {
    const stale = staleFor(url)
    if (stale) return stale
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
