import { authorizedFetch } from '../auth/api'
import { API_BASE } from '../../config/api'
import type { AuthorSummary, CreateChapterInput, CreateMangaInput, MyManga, MyMangaDetail, PublicAuthorProfile } from './types'

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
