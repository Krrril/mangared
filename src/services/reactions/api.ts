import { authorizedFetch } from '../auth/api'
import { API_BASE } from '../../config/api'

export type ReactionType = 'like' | 'dislike'

export interface ReactionSummary {
  likes: number
  dislikes: number
  /** Реакция текущего пользователя — null, если гость или ещё не голосовал. */
  myReaction: ReactionType | null
}

export async function getReactions(mangaId: string, chapterId?: string, token?: string | null): Promise<ReactionSummary> {
  const qs = new URLSearchParams({ mangaId })
  if (chapterId) qs.set('chapterId', chapterId)
  const res = await fetch(`${API_BASE}/reactions?${qs.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) return { likes: 0, dislikes: 0, myReaction: null }
  return res.json()
}

/** Ставит реакцию; повторный тот же тип на бэкенде снимает голос, другой — меняет (см. routes/reactions.ts). */
export function setReaction(token: string, mangaId: string, type: ReactionType, chapterId?: string): Promise<ReactionSummary> {
  return authorizedFetch('/reactions', token, { method: 'POST', body: JSON.stringify({ mangaId, chapterId, type }) })
}
