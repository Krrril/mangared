import {
  getPopularManga,
  getNewManga,
  getMangaById as mdGetMangaById,
  getMangaByIds,
  getMangaStatistics,
  getGenreTags,
  searchManga as mdSearchManga,
  getTopManga as mdGetTopManga,
  getChapterFeed,
  getChapterById as mdGetChapterById,
  getChapterPageUrls,
  getRecentChapters,
} from '../../api/mangadex'
import { mapChapterToLocal, mapMangaToTitle } from './mappers'
import { getAllProgress, getProgressForTitle } from '../progress'
import type { Chapter, ReadingProgress, Title } from './types'

/*
  Адаптер контента — единственная точка, через которую компоненты
  получают данные о манге (см. docs/ARCHITECTURE.md). Раньше внутри были
  моки, теперь — реальный MangaDex API (см. src/api/mangadex). Компоненты
  не знали про моки и не знают про MangaDex — сигнатуры функций почти
  не поменялись (см. docs/DECISIONS.md).
*/

async function mapMangaListWithRatings(mangaList: Awaited<ReturnType<typeof getPopularManga>>): Promise<Title[]> {
  const ratings = await getMangaStatistics(mangaList.map((m) => m.id))
  return mangaList.map((m) => mapMangaToTitle(m, ratings[m.id] ?? 0))
}

/** Несколько самых популярных тайтлов для карусели в hero-баннере на главной. */
export async function getFeaturedTitles(limit = 4): Promise<Title[]> {
  const mangaList = await getPopularManga(limit)
  return mapMangaListWithRatings(mangaList)
}

export async function getPopularToday(limit = 6): Promise<Title[]> {
  const mangaList = await getPopularManga(limit)
  return mapMangaListWithRatings(mangaList)
}

export async function getNewReleases(limit = 8): Promise<Title[]> {
  const mangaList = await getNewManga(limit)
  const titles = await mapMangaListWithRatings(mangaList)
  return titles.map((t) => ({ ...t, isNew: true }))
}

export async function getTopManga(limit = 24): Promise<Title[]> {
  const mangaList = await mdGetTopManga(limit)
  return mapMangaListWithRatings(mangaList)
}

export interface Category {
  id: string
  name: string
}

export async function getCategories(limit = 13): Promise<Category[]> {
  const tags = await getGenreTags()
  return tags.slice(0, limit).map((t) => ({
    id: t.id,
    name: t.attributes.name.en ?? Object.values(t.attributes.name)[0],
  }))
}

/** Все жанровые теги (без обрезки) — для страницы "Категории". */
export async function getAllCategories(): Promise<Category[]> {
  const tags = await getGenreTags()
  return tags.map((t) => ({ id: t.id, name: t.attributes.name.en ?? Object.values(t.attributes.name)[0] }))
}

export async function getTitleById(id: string): Promise<Title | undefined> {
  const manga = await mdGetMangaById(id)
  if (!manga) return undefined
  const ratings = await getMangaStatistics([id])
  return mapMangaToTitle(manga, ratings[id] ?? 0)
}

/** Пакетная загрузка тайтлов по id с рейтингами — используется избранным, историей и лентой обновлений. */
export async function getTitlesByIds(ids: string[]): Promise<Title[]> {
  if (ids.length === 0) return []
  const mangaList = await getMangaByIds(ids)
  return mapMangaListWithRatings(mangaList)
}

export async function getChapters(titleId: string): Promise<Chapter[]> {
  const { chapters } = await getChapterFeed(titleId)
  return chapters.map(({ chapter, alternates }) => mapChapterToLocal(chapter, titleId, alternates))
}

export async function getChapterById(titleId: string, chapterId: string): Promise<Chapter | undefined> {
  const chapter = await mdGetChapterById(chapterId)
  return chapter ? mapChapterToLocal(chapter, titleId) : undefined
}

/**
 * Реальные ссылки на страницы главы — запрашиваются только при открытии
 * читалки, картинки нигде не скачиваются и не хранятся (см. ARCHITECTURE.md).
 */
export async function getChapterPages(chapterId: string): Promise<string[]> {
  return getChapterPageUrls(chapterId)
}

export interface ContinueReadingEntry {
  title: Title
  progress: ReadingProgress
}

export async function getContinueReading(): Promise<ContinueReadingEntry[]> {
  const progressList = await getAllProgress()
  if (progressList.length === 0) return []

  const titles = await getTitlesByIds(progressList.map((p) => p.titleId))
  const titlesById = new Map(titles.map((t) => [t.id, t]))

  return progressList
    .map((progress) => {
      const title = titlesById.get(progress.titleId)
      return title ? { title, progress } : null
    })
    .filter((e): e is ContinueReadingEntry => e !== null)
}

export async function getProgressFor(titleId: string): Promise<ReadingProgress | undefined> {
  return getProgressForTitle(titleId)
}

export interface UpdateFeedEntry {
  title: Title
  chapterId: string
  chapterNumber: number
  minutesAgo: number
  isExternal: boolean
  externalUrl: string | undefined
}

export async function getUpdatesFeed(limit = 5): Promise<UpdateFeedEntry[]> {
  const chapters = await getRecentChapters(limit * 3) // с запасом — часть title могут повторяться
  const uniqueMangaIds: string[] = []
  const chapterByMangaId = new Map<string, (typeof chapters)[number]>()

  for (const chapter of chapters) {
    const mangaId = chapter.relationships.find((r) => r.type === 'manga')?.id
    if (!mangaId || chapterByMangaId.has(mangaId)) continue
    chapterByMangaId.set(mangaId, chapter)
    uniqueMangaIds.push(mangaId)
    if (uniqueMangaIds.length >= limit) break
  }

  const mangaList = await getMangaByIds(uniqueMangaIds)
  const titlesById = new Map(mangaList.map((m) => [m.id, mapMangaToTitle(m)]))
  const now = Date.now()

  return uniqueMangaIds
    .map((mangaId) => {
      const title = titlesById.get(mangaId)
      const chapter = chapterByMangaId.get(mangaId)
      if (!title || !chapter) return null
      const minutesAgo = Math.max(0, Math.round((now - new Date(chapter.attributes.readableAt).getTime()) / 60000))
      const chapterNumber = chapter.attributes.chapter ? Number.parseFloat(chapter.attributes.chapter) : 0
      return {
        title,
        chapterId: chapter.id,
        chapterNumber,
        minutesAgo,
        isExternal: !!chapter.attributes.externalUrl,
        externalUrl: chapter.attributes.externalUrl ?? undefined,
      }
    })
    .filter((e): e is UpdateFeedEntry => e !== null)
}

export interface SearchTitlesParams {
  query?: string
  /** id жанрового тега (см. getCategories/getAllCategories) — фильтр по жанру, без текста */
  genreId?: string
}

export async function searchTitles({ query, genreId }: SearchTitlesParams): Promise<Title[]> {
  if (!query?.trim() && !genreId) return []
  const mangaList = await mdSearchManga({
    title: query?.trim() || undefined,
    includedTags: genreId ? [genreId] : undefined,
  })
  return mapMangaListWithRatings(mangaList)
}

export type { Title, Chapter, ReadingProgress } from './types'
