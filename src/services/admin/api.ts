import { authorizedFetch } from '../auth/api'

export interface AdminUser {
  id: string
  name: string
  email: string
  createdAt: string
  isAdmin: boolean
  loginMethod: 'email' | 'google' | 'email+google'
}

export type AdminSort = 'createdAt_desc' | 'createdAt_asc'

export async function fetchAdminUsers(token: string, params: { q?: string; sort?: AdminSort } = {}) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.sort) qs.set('sort', params.sort)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return authorizedFetch(`/admin/users${suffix}`, token) as Promise<AdminUser[]>
}

export interface PendingOriginal {
  id: string
  title: string
  description: string
  coverUrl: string | null
  genres: string[]
  contentType: 'manga' | 'manhwa' | 'comic'
  chaptersCount: number
  updatedAt: string
  author: { username: string; displayName: string }
}

export function fetchPendingOriginals(token: string): Promise<PendingOriginal[]> {
  return authorizedFetch('/admin/originals/pending', token)
}

export function approveOriginal(token: string, id: string) {
  return authorizedFetch(`/admin/originals/${id}/approve`, token, { method: 'POST' })
}

export function rejectOriginal(token: string, id: string) {
  return authorizedFetch(`/admin/originals/${id}/reject`, token, { method: 'POST' })
}

// --- Полный контроль над контентом (см. ARCHITECTURE.md, "Админ-панель: контроль над контентом") ---

export type MangaStatus = 'draft' | 'pending' | 'published' | 'rejected'

export interface AdminManga {
  id: string
  title: string
  coverUrl: string | null
  status: MangaStatus
  contentType: 'manga' | 'manhwa' | 'comic'
  chaptersCount: number
  updatedAt: string
  author: { username: string; displayName: string }
  /** Кто и когда одобрил/отклонил — только для status published/rejected (см. GET /admin/mangas). */
  decision: { admin: string; at: string; action: string } | null
}

export function fetchAdminMangas(token: string, params: { status?: MangaStatus; q?: string } = {}): Promise<AdminManga[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.q) qs.set('q', params.q)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return authorizedFetch(`/admin/mangas${suffix}`, token)
}

export interface AdminMangaChapter {
  id: string
  number: number
  title: string | null
  pages: string[]
  publishedAt: string
}

export interface AdminMangaDetail {
  id: string
  title: string
  description: string
  coverUrl: string | null
  genres: string[]
  contentType: 'manga' | 'manhwa' | 'comic'
  status: MangaStatus
  createdAt: string
  updatedAt: string
  author: { username: string; displayName: string }
  chapters: AdminMangaChapter[]
}

/** Полная карточка тайтла (все главы + страницы) — для окна детального просмотра на модерации, см. Admin.tsx. */
export function fetchAdminMangaDetail(token: string, id: string): Promise<AdminMangaDetail> {
  return authorizedFetch(`/admin/mangas/${id}`, token)
}

export interface UpdateMangaInput {
  title?: string
  description?: string
  coverUrl?: string
  genres?: string[]
  contentType?: 'manga' | 'manhwa' | 'comic'
}

export function updateAdminManga(token: string, id: string, patch: UpdateMangaInput) {
  return authorizedFetch(`/admin/mangas/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteAdminManga(token: string, id: string) {
  return authorizedFetch(`/admin/mangas/${id}`, token, { method: 'DELETE' })
}

export function deleteAdminChapter(token: string, id: string) {
  return authorizedFetch(`/admin/chapters/${id}`, token, { method: 'DELETE' })
}

export function deleteAdminPage(token: string, chapterId: string, pageIndex: number): Promise<{ ok: true; pages: string[] }> {
  return authorizedFetch(`/admin/chapters/${chapterId}/pages/${pageIndex}`, token, { method: 'DELETE' })
}

export function deleteAdminUser(token: string, id: string) {
  return authorizedFetch(`/admin/users/${id}`, token, { method: 'DELETE' })
}

export interface AdminLogEntry {
  id: string
  adminName: string
  action: string
  targetType: string
  targetId: string
  details: string | null
  createdAt: string
}

export function fetchAdminLogs(token: string): Promise<AdminLogEntry[]> {
  return authorizedFetch('/admin/logs', token)
}
