import { Router } from 'express'
import { z } from 'zod'
import { mdGet, USER_AGENT } from '../services/mangadexClient.js'
import { getWorkingLanguages, reportLanguageProblem } from '../services/mangadexLanguages.js'

export const mangadexRouter = Router()

const REPORT_URL = 'https://api.mangadex.network/report'

/*
  Рабочие языки тайтла (см. services/mangadexLanguages.ts): только те, на
  которых есть реально читаемая глава. Отдельный путь с "_" — чтобы не
  пересечься с путями самого MangaDex, которые пересылает catch-all ниже.
*/
mangadexRouter.get('/_languages/:mangaId', async (req, res) => {
  const mangaId = req.params.mangaId
  if (!/^[0-9a-f-]{36}$/i.test(mangaId)) {
    res.status(400).json({ error: 'Некорректный id' })
    return
  }
  try {
    res.json({ languages: await getWorkingLanguages(mangaId) })
  } catch (err) {
    console.error('Ошибка проверки языков MangaDex', err)
    res.status(502).json({ error: 'MangaDex временно недоступен' })
  }
})

const languageProblemSchema = z.object({
  mangaId: z.string().regex(/^[0-9a-f-]{36}$/i),
  language: z.string().regex(/^[a-z]{2,3}(-[a-z]{2,3})?$/i),
})

/** Читатель сообщает, что глава на этом языке не открылась после повторов (см. Reader.tsx). */
mangadexRouter.post('/_language-problem', (req, res) => {
  const parsed = languageProblemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные данные' })
    return
  }
  reportLanguageProblem(parsed.data.mangaId, parsed.data.language.toLowerCase(), req.ip ?? 'unknown')
  res.status(202).json({ ok: true })
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
      return host.endsWith('.mangadex.network')
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

/*
  Прокси к MangaDex API: пересылаем путь и query как есть (см. DECISIONS.md —
  MangaDex не отдаёт CORS для чужих сайтов). Кэш, склейка и ограничитель
  частоты — в services/mangadexClient.ts. Специальный параметр _fresh=1 (его
  ставит фронтенд, когда картинка с выданного узла не загрузилась) пропускает
  кэш — MangaDex просит в этом случае запросить at-home заново; из запроса к
  MangaDex параметр убирается.
*/
mangadexRouter.get('/*', async (req, res) => {
  try {
    const parsed = new URL(req.url, 'http://local')
    // /manga/random каждый раз отдаёт новый тайтл — его нельзя ни кэшировать, ни склеивать.
    const isRandom = parsed.pathname.endsWith('/random')
    const fresh = parsed.searchParams.get('_fresh') === '1'
    parsed.searchParams.delete('_fresh')
    const entry = await mdGet(`${parsed.pathname}${parsed.search}`, { fresh, cacheable: !isRandom })
    res.status(entry.status).type('application/json').send(entry.body)
  } catch (err) {
    console.error('Ошибка проверки/прокси MangaDex', err)
    res.status(502).json({ error: 'MangaDex временно недоступен' })
  }
})
