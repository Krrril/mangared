import type { ReadingProgress } from '../content/types'

/*
  Прогресс чтения на MVP хранится в localStorage — своего пользователя
  и бэкенда ещё нет (см. docs/DECISIONS.md, авторизация — в v2).
  Когда появится бэкенд, эта реализация меняется на запросы к API —
  остальной код продолжит вызывать те же функции.
*/

const STORAGE_KEY = 'mangared:progress'

function readAll(): Record<string, ReadingProgress> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, ReadingProgress>
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, ReadingProgress>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getAllProgress(): ReadingProgress[] {
  return Object.values(readAll()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function getProgressForTitle(titleId: string): ReadingProgress | undefined {
  return readAll()[titleId]
}

export function saveProgress(entry: ReadingProgress) {
  const all = readAll()
  all[entry.titleId] = entry
  writeAll(all)
}
