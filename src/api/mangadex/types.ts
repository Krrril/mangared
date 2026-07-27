/* Сырые формы ответов MangaDex API — только те поля, которые реально используем. */

export interface MDLocalizedString {
  [locale: string]: string
}

export interface MDRelationship {
  id: string
  type: string
  attributes?: Record<string, unknown>
}

export interface MDTagAttributes {
  name: MDLocalizedString
  group: 'genre' | 'theme' | 'format' | 'content'
}

export interface MDTag {
  id: string
  type: 'tag'
  attributes: MDTagAttributes
}

export interface MDMangaAttributes {
  title: MDLocalizedString
  altTitles: MDLocalizedString[]
  description: MDLocalizedString
  contentRating: string
  status: string
  tags: MDTag[]
  originalLanguage: string
  lastChapter: string | null
  year: number | null
}

export interface MDManga {
  id: string
  type: 'manga'
  attributes: MDMangaAttributes
  relationships: MDRelationship[]
}

export interface MDChapterAttributes {
  chapter: string | null
  title: string | null
  translatedLanguage: string
  pages: number
  externalUrl: string | null
  publishAt: string
  readableAt: string
}

export interface MDChapter {
  id: string
  type: 'chapter'
  attributes: MDChapterAttributes
  relationships: MDRelationship[]
}

export interface MDListResponse<T> {
  result: string
  data: T[]
  limit: number
  offset: number
  total: number
}

export interface MDEntityResponse<T> {
  result: string
  data: T
}

export interface MDAtHomeResponse {
  result: string
  baseUrl: string
  chapter: {
    hash: string
    data: string[]
    dataSaver: string[]
  }
}

export interface MDStatisticsEntry {
  rating: {
    average: number | null
    bayesian: number | null
  }
  follows: number
}

export interface MDStatisticsResponse {
  result: string
  statistics: Record<string, MDStatisticsEntry>
}
