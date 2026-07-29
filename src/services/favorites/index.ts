import { getStoredToken } from '../auth/token'
import { authorizedFetch } from '../auth/api'

/*
  Избранное: если пользователь авторизован — уходит на бэкенд (PostgreSQL),
  иначе остаётся в localStorage конкретного браузера (гостевой режим).
  Тот же паттерн, что и в services/progress.
*/

const STORAGE_KEY = 'mangared:favorites'

function readAllLocal(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAllLocal(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

/** Только гостевые данные из localStorage, минуя авторизацию — для переноса в аккаунт при входе (см. services/migration). */
export function getLocalFavoriteIds(): string[] {
  return readAllLocal()
}

export function clearLocalFavorites(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export async function getFavoriteIds(): Promise<string[]> {
  const token = getStoredToken()
  if (token) {
    return authorizedFetch('/favorites', token)
  }
  return readAllLocal()
}

export async function isFavorite(titleId: string): Promise<boolean> {
  const ids = await getFavoriteIds()
  return ids.includes(titleId)
}

/** Переключает состояние и возвращает новое значение (true — добавлено, false — убрано). */
export async function toggleFavorite(titleId: string): Promise<boolean> {
  const token = getStoredToken()

  if (token) {
    const currentlyFavorite = await isFavorite(titleId)
    if (currentlyFavorite) {
      await authorizedFetch(`/favorites/${titleId}`, token, { method: 'DELETE' })
      return false
    }
    await authorizedFetch('/favorites', token, {
      method: 'POST',
      body: JSON.stringify({ mangaId: titleId }),
    })
    return true
  }

  const ids = readAllLocal()
  const index = ids.indexOf(titleId)
  if (index === -1) {
    ids.push(titleId)
    writeAllLocal(ids)
    return true
  }
  ids.splice(index, 1)
  writeAllLocal(ids)
  return false
}
