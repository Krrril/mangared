import { authorizedFetch } from '../auth/api'
import { getStoredToken } from '../auth/token'
import { API_BASE } from '../../config/api'
import type {
  AuthorSummary,
  CreateChapterInput,
  CreateMangaInput,
  MangaContentType,
  MyManga,
  MyMangaDetail,
  OriginalsSort,
  PublicAuthorProfile,
  PublicChapter,
  PublicManga,
  PublicMangaDetail,
  SocialLink,
} from './types'

export function createManga(token: string, input: CreateMangaInput): Promise<MyManga> {
  return authorizedFetch('/originals/mangas', token, { method: 'POST', body: JSON.stringify(input) })
}

export function getMyMangas(token: string): Promise<MyManga[]> {
  return authorizedFetch('/originals/mine', token)
}

export function getMyManga(token: string, id: string): Promise<MyMangaDetail> {
  return authorizedFetch(`/originals/mine/${id}`, token)
}

export function updateManga(token: string, id: string, patch: Partial<CreateMangaInput>): Promise<MyManga> {
  return authorizedFetch(`/originals/mine/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function submitManga(token: string, id: string): Promise<MyManga> {
  return authorizedFetch(`/originals/mine/${id}/submit`, token, { method: 'POST' })
}

export function addChapter(token: string, mangaId: string, input: CreateChapterInput) {
  return authorizedFetch(`/originals/mine/${mangaId}/chapters`, token, { method: 'POST', body: JSON.stringify(input) })
}

export function getMyAuthorProfile(token: string): Promise<AuthorSummary> {
  return authorizedFetch('/originals/authors/me', token)
}

export interface UpdateAuthorProfileInput {
  displayName?: string
  bio?: string
  avatarUrl?: string
  socialLinks?: SocialLink[]
}

export function updateMyAuthorProfile(token: string, patch: UpdateAuthorProfileInput): Promise<AuthorSummary> {
  return authorizedFetch('/originals/authors/me', token, { method: 'PATCH', body: JSON.stringify(patch) })
}

/** Публичный профиль — доступен без входа, но с токеном сервер сразу вернёт isFollowing для этого зрителя. */
export async function getAuthorProfile(username: string, token: string | null): Promise<PublicAuthorProfile> {
  const res = await fetch(`${API_BASE}/originals/authors/${username}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Ошибка сервера (${res.status})`)
  return data
}

export function toggleFollowAuthor(token: string, username: string): Promise<{ following: boolean }> {
  return authorizedFetch(`/originals/authors/${username}/follow`, token, { method: 'POST' })
}

// --- Публичный каталог Originals — без авторизации ---

async function publicFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Ошибка сервера (${res.status})`)
  return data
}

/*
  Тот же публичный эндпоинт, но с токеном, если он есть (не требует его —
  просто передаёт, если пользователь вошёл). Нужен для превью тайтла/главы
  любого статуса админом (см. optionalAuth на этих роутах в
  server/src/routes/originals.ts) — гостю или обычному пользователю
  лишний заголовок ничего не даёт, сервер всё равно проверит isAdmin сам.
*/
async function publicFetchWithOptionalAuth<T>(path: string): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Ошибка сервера (${res.status})`)
  return data
}

export interface PublicMangasFilter {
  sort?: OriginalsSort
  genre?: string
  contentType?: MangaContentType
}

export function getPublicMangas(filter: PublicMangasFilter = {}): Promise<PublicManga[]> {
  const qs = new URLSearchParams()
  qs.set('sort', filter.sort ?? 'new')
  if (filter.genre) qs.set('genre', filter.genre)
  if (filter.contentType) qs.set('contentType', filter.contentType)
  return publicFetch(`/originals/mangas?${qs.toString()}`)
}

/** Жанры, реально встречающиеся среди опубликованных Originals — для фильтра в /originals (см. OriginalsCatalog.tsx). */
export function getOriginalsGenres(): Promise<string[]> {
  return publicFetch('/originals/genres')
}

export function getPublicManga(id: string): Promise<PublicMangaDetail> {
  return publicFetchWithOptionalAuth(`/originals/mangas/${id}`)
}

export function getPublicChapter(mangaId: string, chapterId: string): Promise<PublicChapter> {
  return publicFetchWithOptionalAuth(`/originals/mangas/${mangaId}/chapters/${chapterId}`)
}
