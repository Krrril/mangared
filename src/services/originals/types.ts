import type { AgeRating, SelectableAgeRating } from '../../constants/ageRating'

export type MangaContentType = 'manga' | 'manhwa' | 'comic'
export type MangaStatus = 'draft' | 'pending' | 'published' | 'rejected'
export type { AgeRating, SelectableAgeRating }

export interface SocialLink {
  label: string
  url: string
}

export interface AuthorSummary {
  id: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  boostyUrl: string | null
  socialLinks: SocialLink[]
  followersCount: number
}

export interface AuthorWorkSummary {
  id: string
  title: string
  coverUrl: string | null
  contentType: MangaContentType
  ageRating: AgeRating
  chaptersCount: number
}

export interface PublicAuthorProfile extends AuthorSummary {
  worksCount: number
  totalReads: number
  followingCount: number
  isFollowing: boolean
  isOwnProfile: boolean
  mangas: AuthorWorkSummary[]
}

export interface MyMangaChapter {
  id: string
  number: number
  title: string | null
  pages: string[]
  publishedAt: string
}

export interface MyManga extends TitleStatsFields {
  id: string
  authorId: string
  title: string
  description: string
  coverUrl: string | null
  genres: string[]
  contentType: MangaContentType
  ageRating: AgeRating
  status: MangaStatus
  chaptersCount: number
  createdAt: string
  updatedAt: string
}

export interface MyMangaDetail extends Omit<MyManga, 'chaptersCount'> {
  chapters: MyMangaChapter[]
}

export interface CreateMangaInput {
  title: string
  description: string
  coverUrl?: string
  genres: string[]
  contentType: MangaContentType
  ageRating: SelectableAgeRating
  agreedToRules: true
}

export interface CreateChapterInput {
  number: number
  title?: string
  pages: string[]
}

/** Просмотры/лайки — см. TitleStats на бэкенде. "Лайк" = добавление в избранное, отдельной сущности нет. */
export interface TitleStatsFields {
  viewsCount: number
  favoritesCount: number
}

export interface PublicManga extends TitleStatsFields {
  id: string
  title: string
  description: string
  coverUrl: string | null
  genres: string[]
  contentType: MangaContentType
  ageRating: AgeRating
  chaptersCount: number
  author: AuthorSummary
}

export interface PublicMangaChapterSummary {
  id: string
  number: number
  title: string | null
  publishedAt: string
}

export interface PublicMangaDetail extends Omit<PublicManga, 'chaptersCount'> {
  /** Не-published виден только админу в превью (см. routes/originals.ts, optionalAuth на GET /mangas/:id) — для гостя тут всегда 'published'. */
  status: MangaStatus
  chapters: PublicMangaChapterSummary[]
}

export interface PublicChapter {
  id: string
  mangaId: string
  number: number
  title: string | null
  pages: string[]
  contentType: MangaContentType
}

export type OriginalsSort = 'new' | 'popular'

/** Запись в списке подписчиков автора — обычный читатель может не иметь своего AuthorProfile (никогда не публиковался), тогда profileUsername === null и ссылка на профиль не показывается (см. AuthorProfile.tsx). */
export interface FollowerEntry {
  userId: string
  name: string
  avatarUrl: string | null
  profileUsername: string | null
}
