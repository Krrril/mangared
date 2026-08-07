import { getContinueReading, getTopManga } from '../services/content'
import type { Title } from '../services/content/types'

/*
  "Умная случайная лента" на главной (RandomFeed) — см. компонент
  src/components/RandomFeed.tsx. Всё, что касается выбора и скрытия
  тайтлов, живёт здесь, отдельно от UI: сам компонент только рисует то,
  что возвращает getWeightedRandomTitles(), и вызывает hideTitleTemporarily()
  по свайпу/клику на крестик.
*/

const HIDDEN_TITLES_KEY = 'mangagreen_hidden_titles'
export const DEFAULT_HIDE_MINUTES = 30

interface HiddenEntry {
  titleId: string
  hiddenUntil: number
}

function readHiddenEntries(): HiddenEntry[] {
  const raw = localStorage.getItem(HIDDEN_TITLES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeHiddenEntries(entries: HiddenEntry[]) {
  localStorage.setItem(HIDDEN_TITLES_KEY, JSON.stringify(entries))
}

/** Живые (не протухшие) id — заодно чистит протухшие записи из localStorage. */
export function getHiddenTitleIds(): Set<string> {
  const now = Date.now()
  const entries = readHiddenEntries()
  const alive = entries.filter((e) => e.hiddenUntil > now)
  if (alive.length !== entries.length) writeHiddenEntries(alive)
  return new Set(alive.map((e) => e.titleId))
}

/** Скрывает тайтл из ленты/сетки на N минут (по умолчанию 30) — свайп влево / крестик. */
export function hideTitleTemporarily(titleId: string, minutes = DEFAULT_HIDE_MINUTES): void {
  const now = Date.now()
  const entries = readHiddenEntries().filter((e) => e.hiddenUntil > now && e.titleId !== titleId)
  entries.push({ titleId, hiddenUntil: now + minutes * 60_000 })
  writeHiddenEntries(entries)
}

// --- Пул каталога и сигналы истории чтения — кэшируются на сессию (см. ниже) ---

let catalogPoolPromise: Promise<Title[]> | null = null

/**
 * Пул тайтлов, из которого рандомит getWeightedRandomTitles. Загружается
 * один раз за сессию (модульный кэш, живёт пока открыта вкладка) — повторные
 * "прокрутки кубика" и ре-рендеры компонента не бьют по MangaDex API заново.
 */
function getCatalogPool(): Promise<Title[]> {
  if (!catalogPoolPromise) {
    catalogPoolPromise = getTopManga(40).catch((err) => {
      catalogPoolPromise = null // при ошибке — не кэшировать провал, дать шанс повторить в следующий раз
      throw err
    })
  }
  return catalogPoolPromise
}

interface HistorySignals {
  /** Жанры из последних прочитанных тайтлов */
  genres: Set<string>
  /** id тайтлов, которые уже есть в истории чтения */
  readTitleIds: Set<string>
}

let historySignalsPromise: Promise<HistorySignals> | null = null

/**
 * Жанры и id из истории чтения — источник одинаковый что для гостя, что для
 * авторизованного пользователя: getContinueReading() уже сам решает, брать
 * прогресс с бэкенда (Prisma/PostgreSQL) или из localStorage (см.
 * services/progress). Пересчитывается раз за сессию, не на каждый рендер.
 */
function getHistorySignals(): Promise<HistorySignals> {
  if (!historySignalsPromise) {
    historySignalsPromise = getContinueReading().then((entries) => {
      const genres = new Set<string>()
      const readTitleIds = new Set<string>()
      for (const { title } of entries) {
        readTitleIds.add(title.id)
        for (const g of title.genres) genres.add(g)
      }
      return { genres, readTitleIds }
    })
  }
  return historySignalsPromise
}

/** Сбрасывает кэш сигналов истории — вызвать после существенного обновления прогресса чтения, если понадобится. */
export function invalidateHistorySignals(): void {
  historySignalsPromise = null
}

function weightFor(title: Title, signals: HistorySignals): number {
  let weight = 1 // base
  if (title.genres.some((g) => signals.genres.has(g))) weight += 2
  if (!signals.readTitleIds.has(title.id)) weight += 3
  return weight
}

function weightedSampleWithoutReplacement(entries: Array<{ title: Title; weight: number }>, count: number): Title[] {
  const pool = [...entries]
  const result: Title[] = []

  while (result.length < count && pool.length > 0) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0)
    let r = Math.random() * total
    let pickIndex = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight
      if (r <= 0) {
        pickIndex = i
        break
      }
    }
    result.push(pool[pickIndex].title)
    pool.splice(pickIndex, 1)
  }

  return result
}

/**
 * Взвешенный случайный выбор count тайтлов из уже загруженного каталога.
 * Веса: base=1, +2 за пересечение жанров с историей чтения, +3 если тайтла
 * ещё нет в истории; скрытые (hideTitleTemporarily) исключаются полностью.
 */
export async function getWeightedRandomTitles(count: number): Promise<Title[]> {
  const [pool, signals] = await Promise.all([getCatalogPool(), getHistorySignals()])
  const hiddenIds = getHiddenTitleIds()

  const candidates = pool
    .filter((title) => !hiddenIds.has(title.id))
    .map((title) => ({ title, weight: weightFor(title, signals) }))

  return weightedSampleWithoutReplacement(candidates, count)
}
