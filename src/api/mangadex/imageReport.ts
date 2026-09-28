import { API_BASE } from './constants'
import { isHomeNode } from './pageSources'

/*
  Репорт результатов загрузки картинок в MangaDex@Home — по документации
  (https://api.mangadex.org/docs/04-chapter/retrieving-chapter/) для каждой
  картинки с узла сети сообщается успех/неудача, иначе сеть не узнает, что
  выданный нам узел болен, и продолжит отдавать его. Браузер не может
  постучаться в api.mangadex.network напрямую (CORS), поэтому копим пачку и
  раз в несколько секунд отправляем на наш backend, который пересылает
  (server/src/routes/mangadex.ts, POST /report).
*/
interface ImageReport {
  url: string
  success: boolean
  cached: boolean
  bytes: number
  duration: number
}

const FLUSH_MS = 4000
const MAX_BATCH = 50
let queue: ImageReport[] = []
let timer: number | null = null

function flush() {
  timer = null
  if (queue.length === 0) return
  const reports = queue.splice(0, MAX_BATCH)
  fetch(`${API_BASE}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reports }),
    keepalive: true,
  }).catch(() => {})
  if (queue.length > 0) timer = window.setTimeout(flush, FLUSH_MS)
}

export function reportImageResult(url: string, success: boolean, startedAt: number): void {
  if (!isHomeNode(url)) return
  // Размер и кэш-попадание браузер даёт только по Resource Timing (для чужих
  // доменов без Timing-Allow-Origin — нули) — отправляем то, что реально знаем.
  const entry = success ? (performance.getEntriesByName(url).pop() as PerformanceResourceTiming | undefined) : undefined
  queue.push({
    url,
    success,
    cached: false,
    bytes: success ? Math.round(entry?.encodedBodySize ?? 0) : 0,
    duration: Math.max(0, Math.round(performance.now() - startedAt)),
  })
  if (queue.length >= MAX_BATCH) flush()
  else if (timer === null) timer = window.setTimeout(flush, FLUSH_MS)
}
