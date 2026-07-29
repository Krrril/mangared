export type MangaType = 'Манга' | 'Манхва' | 'Маньхуа' | 'Комикс'

export interface CoverStyle {
  /** Резервный градиент — используется, пока настоящая обложка не пришла или не загрузилась */
  from: string
  to: string
}

export interface Chapter {
  id: string
  titleId: string
  number: number
  title?: string
  releasedAt: string
  translatedLanguage: string
  /** Глава лицензирована и хранится не на MangaDex — открывается только по внешней ссылке */
  isExternal: boolean
  externalUrl?: string
  /** Группа сканлейта — для обязательной атрибуции по правилам MangaDex */
  scanlationGroup?: string
  /** id других переводов этой же главы от других групп — сгруппированы, не показаны отдельно (см. api/mangadex/chapters.ts) */
  alternateIds?: string[]
}

export interface Title {
  id: string
  name: string
  author: string
  /** Художник, если отличается от автора — на MangaDex нет отдельного понятия "издатель" */
  artist?: string
  type: MangaType
  rating: number
  genres: string[]
  description: string
  cover: CoverStyle
  coverUrl?: string
  coverUrlLarge?: string
  chaptersCount: number
  isNew?: boolean
}

export interface ReadingProgress {
  titleId: string
  chapterId: string
  chapterNumber: number
  /** Текущая страница внутри главы (0-индексация, как в читалке) — совпадает со схемой БД на бэкенде */
  pageNumber: number
  updatedAt: string
}
