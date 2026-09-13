import { authorizedFetch } from '../auth/api'
import { API_BASE } from '../../config/api'

export interface CommentAuthor {
  id: string
  name: string
  avatarUrl: string | null
  username: string | null
}

export interface CommentEntry {
  id: string
  text: string
  createdAt: string
  author: CommentAuthor
  /** Свой комментарий этого пользователя — только если запрос был с токеном (см. optionalAuth на бэкенде). */
  mine: boolean
}

/** Публично, без авторизации — читать может кто угодно, комментировать только вошедшие (см. postComment). */
export async function getComments(mangaId: string, chapterId?: string, token?: string | null): Promise<CommentEntry[]> {
  const qs = new URLSearchParams({ mangaId })
  if (chapterId) qs.set('chapterId', chapterId)
  const res = await fetch(`${API_BASE}/comments?${qs.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) return []
  return res.json()
}

export function postComment(token: string, mangaId: string, text: string, chapterId?: string): Promise<CommentEntry> {
  return authorizedFetch('/comments', token, { method: 'POST', body: JSON.stringify({ mangaId, chapterId, text }) })
}

export function deleteComment(token: string, id: string): Promise<{ ok: true }> {
  return authorizedFetch(`/comments/${id}`, token, { method: 'DELETE' })
}

export function reportComment(token: string, id: string): Promise<{ ok: true }> {
  return authorizedFetch(`/comments/${id}/report`, token, { method: 'POST' })
}
