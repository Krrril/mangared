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
