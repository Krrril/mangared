/*
  Избранное на MVP хранится в localStorage — своего пользователя и
  бэкенда ещё нет (см. docs/DECISIONS.md, авторизация — в v2). Паттерн
  такой же, как у progress/index.ts — когда появится бэкенд, меняется
  только реализация, вызывающий код не трогаем.
*/

const STORAGE_KEY = 'mangared:favorites'

function readAll(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function getFavoriteIds(): string[] {
  return readAll()
}

export function isFavorite(titleId: string): boolean {
  return readAll().includes(titleId)
}

export function toggleFavorite(titleId: string): boolean {
  const ids = readAll()
  const index = ids.indexOf(titleId)
  if (index === -1) {
    ids.push(titleId)
    writeAll(ids)
    return true
  }
  ids.splice(index, 1)
  writeAll(ids)
  return false
}
