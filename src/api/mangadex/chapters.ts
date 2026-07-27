import { mdFetch } from './client'
import { CONTENT_RATINGS, CONTENT_LANGUAGE } from './constants'
import type { MDAtHomeResponse, MDChapter, MDListResponse } from './types'

const CHAPTER_INCLUDES = ['scanlation_group']

export interface GroupedChapter {
  chapter: MDChapter
  /** id других переводов этой же главы — от других групп сканлейта, не показываем как отдельные главы */
  alternateIds: string[]
}

export interface ChapterFeed {
  chapters: GroupedChapter[]
  total: number
}

/**
 * Из нескольких переводов одной и той же главы (одинаковый номер, разные
 * группы сканлейта) выбираем один для показа: сначала — не внешний
 * (реально читаемый на MangaDex), затем — с большим числом страниц
 * (обычно более полный/качественный скан), при равенстве — свежее
 * загруженный.
 */
function pickBestChapter(entries: MDChapter[]): MDChapter {
  return entries.reduce((best, current) => {
    const bestExternal = !!best.attributes.externalUrl
    const currentExternal = !!current.attributes.externalUrl
    if (bestExternal !== currentExternal) return currentExternal ? best : current

    if (current.attributes.pages !== best.attributes.pages) {
      return current.attributes.pages > best.attributes.pages ? current : best
    }

    return new Date(current.attributes.readableAt) > new Date(best.attributes.readableAt) ? current : best
  })
}

/**
 * MangaDex отдаёт по несколько записей одной и той же главы, когда её
 * переводило несколько групп сканлейта — без группировки они выглядят
 * как дубли ("Глава 0" несколько раз подряд). Группируем по номеру главы
 * и оставляем одну — лучшую по pickBestChapter (см. выше). Главы без
 * номера (null — обычно одиночные ваншоты/экстры) не группируем друг с
 * другом, чтобы случайно не склеить разный контент.
 */
function groupAndDedupeChapters(chapters: MDChapter[]): GroupedChapter[] {
  const groups = new Map<string, MDChapter[]>()

  for (const chapter of chapters) {
    const key = chapter.attributes.chapter ?? `oneshot-${chapter.id}`
    const existing = groups.get(key)
    if (existing) existing.push(chapter)
    else groups.set(key, [chapter])
  }

  return Array.from(groups.values()).map((group) => {
    const winner = pickBestChapter(group)
    return {
      chapter: winner,
      alternateIds: group.filter((c) => c.id !== winner.id).map((c) => c.id),
    }
  })
}

/**
 * Список глав тайтла. Загружаем последние 100: для MVP этого достаточно,
 * полная пагинация — в бэклог (см. ROADMAP.md).
 */
export async function getChapterFeed(mangaId: string, limit = 100): Promise<ChapterFeed> {
  const res = await mdFetch<MDListResponse<MDChapter>>(`/manga/${mangaId}/feed`, {
    limit,
    translatedLanguage: [CONTENT_LANGUAGE],
    contentRating: [...CONTENT_RATINGS],
    includes: CHAPTER_INCLUDES,
    order: { chapter: 'desc' },
  })
  return { chapters: groupAndDedupeChapters(res.data), total: res.total }
}

export async function getChapterById(chapterId: string): Promise<MDChapter | undefined> {
  try {
    const res = await mdFetch<{ result: string; data: MDChapter }>(`/chapter/${chapterId}`, {
      includes: CHAPTER_INCLUDES,
    })
    return res.data
  } catch {
    return undefined
  }
}

/**
 * Реальные ссылки на страницы главы — запрашиваются только в момент
 * открытия читалки (at-home/server), не заранее и не пакетно: так
 * рекомендует сам MangaDex, и так мы не храним и не скачиваем картинки
 * сами — просто отдаём прямые ссылки на их сеть раздачи.
 */
export async function getChapterPageUrls(chapterId: string): Promise<string[]> {
  const res = await mdFetch<MDAtHomeResponse>(`/at-home/server/${chapterId}`)
  const { baseUrl, chapter } = res
  return chapter.data.map((fileName) => `${baseUrl}/data/${chapter.hash}/${fileName}`)
}

/** Глобальная лента последних вышедших глав — источник для "Последних обновлений" на главной. */
export async function getRecentChapters(limit = 5): Promise<MDChapter[]> {
  const res = await mdFetch<MDListResponse<MDChapter>>('/chapter', {
    limit,
    translatedLanguage: [CONTENT_LANGUAGE],
    contentRating: [...CONTENT_RATINGS],
    order: { readableAt: 'desc' },
  })
  return res.data
}
