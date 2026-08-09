export type MangaContentType = 'manga' | 'manhwa' | 'comic'
export type MangaStatus = 'draft' | 'pending' | 'published' | 'rejected'

export interface AuthorSummary {
  id: string
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  boostyUrl: string | null
  followersCount: number
}

export interface AuthorWorkSummary {
  id: string
  title: string
  coverUrl: string | null
  contentType: MangaContentType
  chaptersCount: number
}

export interface PublicAuthorProfile extends AuthorSummary {
  worksCount: number
  totalReads: number
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

export interface MyManga {
  id: string
  authorId: string
  title: string
  description: string
  coverUrl: string | null
  genres: string[]
  contentType: MangaContentType
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
  agreedToRules: true
}

export interface CreateChapterInput {
  number: number
  title?: string
  pages: string[]
}
