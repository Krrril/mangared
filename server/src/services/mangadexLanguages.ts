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
