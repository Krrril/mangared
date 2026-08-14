import { API_BASE } from '../../config/api'
import { getStoredToken } from '../auth/token'

export interface TitleStats {
  views: number
  favorites: number
}

/** Просмотры/лайки батчем по списку id — карточки MangaDex-каталога, страница тайтла. */
export async function getStats(ids: string[]): Promise<Record<string, TitleStats>> {
  if (ids.length === 0) return {}
  const res = await fetch(`${API_BASE}/stats?ids=${ids.map(encodeURIComponent).join(',')}`)
  if (!res.ok) return {}
  return res.json()
}

/**
 * Засчитывает открытие главы — вызывать один раз при открытии главы в
 * читалке (см. Reader.tsx), для обоих источников контента. Не ждём и не
 * показываем ошибку пользователю — счётчик не должен мешать чтению, даже
 * если запрос не прошёл.
 */
export function recordChapterView(mangaId: string, chapterId: string, source: 'mangadex' | 'original'): void {
  const token = getStoredToken()
  fetch(`${API_BASE}/stats/view`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ mangaId, chapterId, source }),
  }).catch(() => {})
}
