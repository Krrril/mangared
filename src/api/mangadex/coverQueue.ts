/*
  Очередь загрузки обложек: не больше MAX_CONCURRENT одновременно, ближе к
  экрану — раньше. Раньше все ~24 обложки каталога уходили в сеть разом
  (браузерный loading="lazy" на десктопе подгружает сразу несколько экранов),
  а CDN MangaDex не любит всплески. Здесь же — "предохранитель": если подряд
  провалилось много обложек (MangaDex отвечает 403 "Bot challenge not passed"
  на запросы с чужих сайтов), следующие не ходят в сеть и сразу показывают
  кнопку "Повторить", пока не пройдёт пауза или пользователь не нажмёт её.

  Модуль без React и без DOM-зависимостей, кроме getBoundingClientRect/window —
  логика проверяется отдельно (см. coverSources, parseRetryAfter).
*/

const MAX_CONCURRENT = 6
/** На каком расстоянии от экрана (px) обложка уже "рядом" и может занять слот. */
const NEAR_PX = 900
const PUMP_INTERVAL_MS = 1000

interface Entry {
  el: HTMLElement | null
  start: () => void
}

let running = 0
const waiting = new Set<Entry>()
let listening = false
let rafPending = false
let interval: number | null = null

/** Расстояние от элемента до видимой области (0 — на экране); Infinity — не измерить (скрыт). */
function distanceToViewport(el: HTMLElement | null): number {
  if (!el) return 0
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return Number.POSITIVE_INFINITY
  const dy = r.bottom < 0 ? -r.bottom : r.top > window.innerHeight ? r.top - window.innerHeight : 0
  const dx = r.right < 0 ? -r.right : r.left > window.innerWidth ? r.left - window.innerWidth : 0
  return dy + dx
}

function pump(): void {
  while (running < MAX_CONCURRENT && waiting.size > 0) {
    let best: Entry | null = null
    let bestDist = Number.POSITIVE_INFINITY
    for (const entry of waiting) {
      const d = distanceToViewport(entry.el)
      if (d <= NEAR_PX && d < bestDist) {
        best = entry
        bestDist = d
      }
    }
    if (!best) break
    waiting.delete(best)
    running += 1
    best.start()
  }
  if (waiting.size === 0) stopListening()
}

function schedulePump(): void {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    pump()
  })
}

function startListening(): void {
  if (listening) return
  listening = true
  window.addEventListener('scroll', schedulePump, { passive: true, capture: true })
  window.addEventListener('resize', schedulePump)
  // Запасной путь: вкладка/карусель стали видимыми без scroll-события.
  interval = window.setInterval(pump, PUMP_INTERVAL_MS)
}

function stopListening(): void {
  if (!listening) return
  listening = false
  window.removeEventListener('scroll', schedulePump, { capture: true })
  window.removeEventListener('resize', schedulePump)
  if (interval !== null) window.clearInterval(interval)
  interval = null
}

/**
 * Ставит обложку в очередь. start() вызывается, когда ей выдан слот; после
 * окончания попытки (успех, ошибка) нужно вызвать releaseCover(). Возвращает
 * функцию отмены (если слот уже выдан, её вызывать не нужно — release сделает
 * владелец).
 */
export function enqueueCover(el: HTMLElement | null, start: () => void): () => void {
  const entry: Entry = { el, start }
  waiting.add(entry)
  startListening()
  schedulePump()
  return () => {
    waiting.delete(entry)
    if (waiting.size === 0) stopListening()
  }
}

export function releaseCover(): void {
  if (running > 0) running -= 1
  schedulePump()
}

// --- предохранитель -----------------------------------------------------------
const BREAKER_THRESHOLD = 4
const BREAKER_PAUSE_MS = 90_000
let consecutiveFailures = 0
let breakerOpenUntil = 0

export function isCoverBreakerOpen(): boolean {
  return Date.now() < breakerOpenUntil
}

/** Обложка исчерпала все попытки. */
export function noteCoverFailure(): void {
  consecutiveFailures += 1
  if (consecutiveFailures >= BREAKER_THRESHOLD) breakerOpenUntil = Date.now() + BREAKER_PAUSE_MS
}

/** Любая удачная загрузка обложки — CDN снова отвечает, сбрасываем счётчик. */
export function noteCoverSuccess(): void {
  consecutiveFailures = 0
  breakerOpenUntil = 0
}

/** Ручное "Повторить": пользователь явно просит попробовать снова. */
export function resetCoverBreaker(): void {
  consecutiveFailures = 0
  breakerOpenUntil = 0
}

// --- адреса и паузы -------------------------------------------------------------
/**
 * Адреса одной обложки по порядку: запрошенный размер, затем остальные
 * (.256 → .512 → оригинал). Для не-MangaDex адресов (наш R2) — единственный.
 */
export function coverSources(src: string): string[] {
  const m = /^(.*\/covers\/[0-9a-f-]{36}\/[^/?#]+?)(?:\.(256|512)\.jpg)?(\?.*)?$/i.exec(src)
  if (!m || !/uploads\.mangadex\.org/.test(src)) return [src]
  const [, base, size, query = ''] = m
  const variants: Record<string, string> = {
    '256': `${base}.256.jpg${query}`,
    '512': `${base}.512.jpg${query}`,
    original: `${base}${query}`,
  }
  const first = size ?? 'original'
  const order = ['256', '512', 'original']
  return [variants[first], ...order.filter((k) => k !== first).map((k) => variants[k])]
}

/** Retry-After: секунды или HTTP-дата → миллисекунды (с потолком 30 с); undefined — не разобрать. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000)
  const at = Date.parse(value)
  if (Number.isFinite(at)) return Math.min(Math.max(at - now, 0), 30_000)
  return undefined
}

/** Пауза перед повторным проходом: растёт (1.5 с, 4 с), с небольшим разбросом, не меньше Retry-After. */
export function backoffDelay(cycle: number, retryAfterMs?: number, random = Math.random()): number {
  const base = [1500, 4000, 9000][Math.min(cycle, 2)]
  const jitter = Math.round(base * 0.2 * random)
  return Math.max(base + jitter, retryAfterMs ?? 0)
}

export type ProbeResult = { kind: 'ok' } | { kind: 'blocked' } | { kind: 'rateLimited'; retryAfterMs: number } | { kind: 'unknown' }

/**
 * Один запрос после первой неудачи, чтобы узнать причину (403 / 429 +
 * Retry-After): у <img> статуса и заголовков не видно. Это простой GET без
 * нестандартных заголовков (HEAD у CDN MangaDex без CORS-заголовков, а
 * Range вызвал бы preflight): как только пришли заголовки ответа, тело
 * отменяется — картинка целиком не скачивается. CDN отдаёт CORS-заголовки на
 * ошибках, поэтому статус доступен; если нет — результат unknown, и идём
 * обычным порядком.
 */
export async function probeCover(url: string, fetchImpl: typeof fetch = fetch): Promise<ProbeResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    controller.abort() // заголовки получены — тело не нужно
    if (res.status === 429) return { kind: 'rateLimited', retryAfterMs: parseRetryAfter(res.headers.get('retry-after')) ?? 5000 }
    if (res.status === 403 || res.status === 401) return { kind: 'blocked' }
    if (res.ok) return { kind: 'ok' }
    return { kind: 'unknown' }
  } catch {
    return { kind: 'unknown' }
  } finally {
    clearTimeout(timeout)
  }
}
