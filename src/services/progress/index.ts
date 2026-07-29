import type { ReadingProgress } from '../content/types'
import { getStoredToken } from '../auth/token'
import { authorizedFetch } from '../auth/api'

/*
  Прогресс чтения: если пользователь авторизован — уходит на бэкенд
  (PostgreSQL, см. server/prisma/schema.prisma), иначе остаётся в
  localStorage конкретного браузера (гостевой режим). Компоненты вызывают
  одни и те же функции независимо от режима — выбор источника происходит
  здесь, внутри сервиса (см. docs/DECISIONS.md).
*/

const STORAGE_KEY = 'mangared:progress'

function readAllLocal(): Record<string, ReadingProgress> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, ReadingProgress>
  } catch {
    return {}
  }
}

function writeAllLocal(data: Record<string, ReadingProgress>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

interface BackendProgressEntry {
  mangaId: string
  chapterId: string
  chapterNumber: number
  pageNumber: number
  updatedAt: string
}

function fromBackend(entry: BackendProgressEntry): ReadingProgress {
  return {
    titleId: entry.mangaId,
    chapterId: entry.chapterId,
    chapterNumber: entry.chapterNumber,
    pageNumber: entry.pageNumber,
    updatedAt: entry.updatedAt,
  }
}

/** Только гостевые данные из localStorage, минуя авторизацию — для переноса в аккаунт при входе (см. services/migration). */
export function getLocalProgress(): ReadingProgress[] {
  return Object.values(readAllLocal())
}

export function clearLocalProgress(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export async function getAllProgress(): Promise<ReadingProgress[]> {
  const token = getStoredToken()
  if (token) {
    const data: BackendProgressEntry[] = await authorizedFetch('/progress', token)
    return data.map(fromBackend)
  }
  return Object.values(readAllLocal()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export async function getProgressForTitle(titleId: string): Promise<ReadingProgress | undefined> {
  const token = getStoredToken()
  if (token) {
    // Отдельного GET /progress/:mangaId на бэкенде нет — тайтлов с
    // прогрессом у пользователя обычно немного, лишний эндпоинт того не стоит
    const all = await getAllProgress()
    return all.find((p) => p.titleId === titleId)
  }
  return readAllLocal()[titleId]
}

export async function saveProgress(entry: ReadingProgress): Promise<void> {
  const token = getStoredToken()
  if (token) {
    await authorizedFetch('/progress', token, {
      method: 'PUT',
      body: JSON.stringify({
        mangaId: entry.titleId,
        chapterId: entry.chapterId,
        chapterNumber: entry.chapterNumber,
        pageNumber: entry.pageNumber,
      }),
    })
    return
  }
  const all = readAllLocal()
  all[entry.titleId] = entry
  writeAllLocal(all)
}
