import { mdFetch } from './client'
import { CONTENT_RATINGS, CONTENT_LANGUAGE } from './constants'
import type { MDListResponse, MDEntityResponse, MDManga, MDStatisticsResponse, MDTag } from './types'

const MANGA_INCLUDES = ['cover_art', 'author', 'artist']

export async function getPopularManga(limit = 6): Promise<MDManga[]> {
  const res = await mdFetch<MDListResponse<MDManga>>('/manga', {
    limit,
    includes: MANGA_INCLUDES,
    contentRating: [...CONTENT_RATINGS],
    availableTranslatedLanguage: [CONTENT_LANGUAGE],
    order: { followedCount: 'desc' },
  })
  return res.data
}

export async function getNewManga(limit = 8): Promise<MDManga[]> {
  const res = await mdFetch<MDListResponse<MDManga>>('/manga', {
    limit,
    includes: MANGA_INCLUDES,
    contentRating: [...CONTENT_RATINGS],
    availableTranslatedLanguage: [CONTENT_LANGUAGE],
    order: { createdAt: 'desc' },
  })
  return res.data
}

export async function getMangaById(id: string): Promise<MDManga | undefined> {
  try {
    const res = await mdFetch<MDEntityResponse<MDManga>>(`/manga/${id}`, {
      includes: MANGA_INCLUDES,
    })
    return res.data
  } catch {
    return undefined
  }
}

/**
 * Пакетная загрузка нескольких тайтлов по id за один запрос — используется
 * для избранного, истории и ленты обновлений. Если запрос целиком упадёт
 * (например, id из localStorage устарел и больше не проходит валидацию
 * MangaDex — такое бывает после смены источника данных), возвращаем
 * пустой список вместо падения: пусть страница покажет "пусто", а не
 * зависнет на загрузке навсегда.
 */
export async function getMangaByIds(ids: string[]): Promise<MDManga[]> {
  if (ids.length === 0) return []
  try {
    const res = await mdFetch<MDListResponse<MDManga>>('/manga', {
      ids,
      limit: ids.length,
      includes: MANGA_INCLUDES,
      contentRating: [...CONTENT_RATINGS],
    })
    return res.data
  } catch {
    return []
  }
}

export interface SearchMangaParams {
  title?: string
  /** id тегов-жанров (см. getGenreTags) — фильтр "показать мангу этого жанра" */
  includedTags?: string[]
  limit?: number
}

export async function searchManga({ title, includedTags, limit = 20 }: SearchMangaParams): Promise<MDManga[]> {
  const res = await mdFetch<MDListResponse<MDManga>>('/manga', {
    title,
    includedTags,
    limit,
    includes: MANGA_INCLUDES,
    contentRating: [...CONTENT_RATINGS],
  })
  return res.data
}

export async function getTopManga(limit = 24): Promise<MDManga[]> {
  const res = await mdFetch<MDListResponse<MDManga>>('/manga', {
    limit,
    includes: MANGA_INCLUDES,
    contentRating: [...CONTENT_RATINGS],
    availableTranslatedLanguage: [CONTENT_LANGUAGE],
    order: { rating: 'desc' },
  })
  return res.data
}

export async function getMangaStatistics(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {}
  try {
    const res = await mdFetch<MDStatisticsResponse>('/statistics/manga', { manga: ids })
    const ratings: Record<string, number> = {}
    for (const [id, entry] of Object.entries(res.statistics)) {
      ratings[id] = entry.rating.bayesian ?? entry.rating.average ?? 0
    }
    return ratings
  } catch {
    return {}
  }
}

let genreTagsCache: MDTag[] | null = null

/** Список жанровых тегов кэшируется в памяти — он общий и почти не меняется. */
export async function getGenreTags(): Promise<MDTag[]> {
  if (genreTagsCache) return genreTagsCache
  const res = await mdFetch<MDListResponse<MDTag>>('/manga/tag')
  genreTagsCache = res.data.filter((t) => t.attributes.group === 'genre')
  return genreTagsCache
}
