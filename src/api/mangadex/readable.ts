import i18n from '../../i18n'
import { API_BASE, CONTENT_LANGUAGE } from './constants'
import type { MDManga } from './types'

/*
  Фильтр "только читаемые тайтлы": списки MangaDex (каталог, главная, поиск,
  Random Pick) не показывают тайтлы без читаемой главы (не внешняя, pages > 0)
  на доступном языке. Саму проверку делает backend (см. checkReadable в
  server/src/services/mangadexLanguages.ts): по очереди, строго
  последовательно, с кэшем на 12 часов — здесь только одна пачка запросов на
  список и сессионный кэш ответов.

  Отказоустойчивость: если backend не ответил или не успел проверить тайтл
  (null) — тайтл ПОКАЗЫВАЕТСЯ. Лучше лишняя карточка, чем пустая страница.
*/

const REQUEST_TIMEOUT_MS = 6000
const MAX_LANGUAGES = 6
const sessionCache = new Map<string, boolean>()

/** Языки для проверки: английский (язык контента сайта), язык интерфейса, затем остальные доступные. */
function languagesToCheck(manga: MDManga): string[] {
  const available = manga.attributes.availableTranslatedLanguages ?? []
  const preferred = [CONTENT_LANGUAGE, i18n.resolvedLanguage ?? i18n.language ?? 'en']
  const ordered = [...preferred.filter((l) => available.includes(l)), ...available]
  return [...new Set(ordered)].slice(0, MAX_LANGUAGES)
}

/** Оставляет только тайтлы, у которых backend подтвердил читаемую главу (или не смог проверить). */
export async function filterReadable(list: MDManga[]): Promise<MDManga[]> {
  if (list.length === 0) return list

  const toAsk: { id: string; languages: string[] }[] = []
  for (const manga of list) {
    if (sessionCache.has(manga.id)) continue
    const languages = languagesToCheck(manga)
    // Нет данных о языках — проверять нечем, не скрываем.
    if (languages.length > 0) toAsk.push({ id: manga.id, languages })
  }

  if (toAsk.length > 0) {
    try {
      const res = await fetch(`${API_BASE}/_readable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: toAsk.slice(0, 40) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.ok) {
        const data = (await res.json()) as { readable?: Record<string, boolean | null> }
        for (const [id, value] of Object.entries(data.readable ?? {})) {
          if (typeof value === 'boolean') sessionCache.set(id, value)
        }
      }
    } catch {
      // сбой/таймаут — ничего не скрываем
    }
  }

  return list.filter((m) => sessionCache.get(m.id) !== false)
}

export interface CollectedPage {
  data: MDManga[]
  /** Сколько "сырых" записей списка уже просмотрено — с этого offset продолжать. */
  nextOffset: number
  /** true — список MangaDex закончился. */
  exhausted: boolean
}

/**
 * Набирает читаемые тайтлы: берёт страницы списка, фильтрует, и если после
 * фильтра набралось меньше target — подгружает следующую порцию (не больше
 * maxRounds раз, чтобы не нагружать MangaDex и не крутить бесконечно).
 */
export async function collectReadable(
  fetchPage: (offset: number, limit: number) => Promise<{ data: MDManga[]; total?: number }>,
  opts: { target: number; pageSize: number; startOffset?: number; maxRounds?: number },
): Promise<CollectedPage> {
  const { target, pageSize } = opts
  const maxRounds = opts.maxRounds ?? 4
  let offset = opts.startOffset ?? 0
  const seen = new Set<string>()
  const out: MDManga[] = []
  let exhausted = false

  for (let round = 0; round < maxRounds && out.length < target; round++) {
    const page = await fetchPage(offset, pageSize)
    offset += page.data.length
    if (page.data.length < pageSize || (page.total !== undefined && offset >= page.total)) exhausted = true
    for (const m of await filterReadable(page.data)) {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        out.push(m)
      }
    }
    if (exhausted) break
  }
  return { data: out, nextOffset: offset, exhausted }
}
