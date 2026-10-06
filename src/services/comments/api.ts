import { authorizedFetch } from '../auth/api'
import { API_BASE } from '../../config/api'
import type { PremiumSticker } from '../../constants/premium'

export interface CommentAuthor {
  id: string
  name: string
  avatarUrl: string | null
  username: string | null
  /** Premium-оформление (см. constants/premium.tsx) — фона профиля тут нет, только в самом профиле. */
  isPremium: boolean
  avatarFrame: string | null
  accentColor: string | null
}

export interface CommentEntry {
  id: string
  text: string
  createdAt: string
  author: CommentAuthor
  /** Свой комментарий этого пользователя — только если запрос был с токеном (см. optionalAuth на бэкенде). */
  mine: boolean
  /** Число каждого поставленного стикера (см. E5) — отсутствующий ключ = 0. */
  reactions: Partial<Record<PremiumSticker, number>>
  /** Какие стикеры на этом комментарии поставил сам текущий пользователь. */
  myReactions: PremiumSticker[]
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

/** Поставить/снять стикер под комментарием (переключатель) — только Premium, см. E5. */
export function toggleCommentSticker(
  token: string,
  commentId: string,
  type: PremiumSticker,
): Promise<{ reactions: Partial<Record<PremiumSticker, number>>; myReactions: PremiumSticker[] }> {
  return authorizedFetch(`/comments/${commentId}/reactions`, token, { method: 'POST', body: JSON.stringify({ type }) })
}
