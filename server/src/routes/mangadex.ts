import { Router } from 'express'
import { z } from 'zod'

export const mangadexRouter = Router()

const MANGADEX_BASE = 'https://api.mangadex.org'
const REPORT_URL = 'https://api.mangadex.network/report'

/*
  MangaDex требует User-Agent (не подделанный) и запрещает Via — Node fetch
  шлёт UA "node", поэтому ставим свой честный.
*/
const USER_AGENT = 'MangaGreen/1.0 (+https://www.mangagreen.com)'

/*
  ВСЕ пользователи сайта ходят к MangaDex с одного IP этого сервера, а лимиты
  MangaDex — на IP: ~5 запросов/с на весь api.mangadex.org и 40 запросов/мин
  на /at-home/server/{id} (https://api.mangadex.org/docs/2-limitations/).
  Поэтому идентичные запросы разных читателей не должны каждый раз уходить
  наверх: короткий кэш успешных ответов + склейка одновременных одинаковых
  запросов в один. Ответ at-home (baseUrl) MangaDex гарантирует ~15 минут,
  держим 4 — с запасом.
*/
const DEFAULT_TTL_MS = 60_000
const AT_HOME_TTL_MS = 4 * 60_000
const MAX_CACHE_ENTRIES = 400
// Огромные ответы (фид на 500 глав) в кэш не кладём — чтобы он не раздувал память.
const MAX_CACHED_BODY = 300_000

interface CacheEntry {
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

async function fetchUpstream(url: string): Promise<CacheEntry> {
  const upstream = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  const body = await upstream.text()
  return { status: upstream.status, body, expiresAt: 0 }
}

/*
  Пересылаем путь и query как есть. Специальный параметр _fresh=1 (его ставит
  фронтенд, когда картинка с выданного узла не загрузилась) пропускает кэш —
  MangaDex просит в этом случае запросить at-home заново, а не отдавать
  прежний baseUrl. Из запроса к MangaDex параметр убирается.
*/
mangadexRouter.get('/*', async (req, res) => {
  try {
    const parsed = new URL(req.url, 'http://local')
    // /manga/random каждый раз отдаёт новый тайтл — его нельзя ни кэшировать, ни склеивать.
    const fresh = parsed.searchParams.get('_fresh') === '1' || parsed.pathname.endsWith('/random')
    parsed.searchParams.delete('_fresh')
    const path = parsed.pathname
    const upstreamUrl = `${MANGADEX_BASE}${path}${parsed.search}`

    const cached = cache.get(upstreamUrl)
    if (!fresh && cached && cached.expiresAt > Date.now()) {
      res.status(cached.status).type('application/json').send(cached.body)
      return
    }

    let pending = fresh ? undefined : inFlight.get(upstreamUrl)
    if (!pending) {
      pending = fetchUpstream(upstreamUrl).finally(() => {
        if (inFlight.get(upstreamUrl) === pending) inFlight.delete(upstreamUrl)
      })
      if (!fresh) inFlight.set(upstreamUrl, pending)
    }
    const entry = await pending
    if (entry.status === 200 && entry.body.length < MAX_CACHED_BODY && !parsed.pathname.endsWith('/random')) remember(upstreamUrl, { ...entry, expiresAt: Date.now() + ttlFor(path) })
    res.status(entry.status).type('application/json').send(entry.body)
  } catch (err) {
    console.error('Ошибка прокси к MangaDex', err)
    res.status(502).json({ error: 'MangaDex временно недоступен' })
  }
})

/*
  Репорт результатов загрузки картинок в сеть MangaDex@Home (по документации
  https://api.mangadex.org/docs/04-chapter/retrieving-chapter/): для каждой
  картинки с базового URL, не содержащего mangadex.org, сообщается успех/
  неудача — по этим данным сеть отключает больные узлы. Браузер туда напрямую
  не может (CORS), поэтому фронтенд шлёт пачку сюда, а мы пересылаем.
  Best-effort: пока api.mangadex.network недоступен (сейчас отвечает 522),
  автоматически "выключаемся" на 10 минут, чтобы не тратить ресурсы.
*/
const reportItemSchema = z.object({
  url: z.string().url().max(600),
  success: z.boolean(),
  cached: z.boolean(),
  bytes: z.number().int().min(0).max(200_000_000),
  duration: z.number().int().min(0).max(600_000),
})
const reportBatchSchema = z.object({ reports: z.array(reportItemSchema).min(1).max(60) })

let reportPausedUntil = 0
const REPORT_PAUSE_MS = 10 * 60_000

mangadexRouter.post('/report', async (req, res) => {
  const parsed = reportBatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректный репорт' })
    return
  }
  // Только картинки с узлов сети: пересылать чужие URL никому не нужно.
  const reports = parsed.data.reports.filter((r) => {
    try {
      const host = new URL(r.url).hostname
      return host.endsWith('.mangadex.network') && !host.endsWith('mangadex.org')
    } catch {
      return false
    }
  })
  res.status(202).json({ accepted: reports.length })
  if (reports.length === 0 || Date.now() < reportPausedUntil) return

  for (const r of reports) {
    try {
      const upstream = await fetch(REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify(r),
        signal: AbortSignal.timeout(4000),
      })
      if (upstream.status >= 500) {
        reportPausedUntil = Date.now() + REPORT_PAUSE_MS
        return
      }
    } catch {
      reportPausedUntil = Date.now() + REPORT_PAUSE_MS
      return
    }
  }
})
