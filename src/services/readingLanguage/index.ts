import { sortLanguages } from '../../constants/languages'

/*
  Язык ЧТЕНИЯ тайтла (на каком языке страницы глав) — не путать с языком
  интерфейса (?lang=, i18n). Выбор запоминается в localStorage отдельно
  для каждого тайтла. В URL передаётся параметром ?read=xx.
*/
export const READ_PARAM = 'read'

const key = (titleId: string) => `mangagreen.readLang.${titleId}`

export function getStoredReadingLanguage(titleId: string): string | null {
  try {
    return localStorage.getItem(key(titleId))
  } catch {
    return null
  }
}

export function storeReadingLanguage(titleId: string, language: string): void {
  try {
    localStorage.setItem(key(titleId), language)
  } catch {
    /* localStorage недоступен (приватный режим) — выбор просто не запомнится */
  }
}

export function readingPath(basePath: string, language: string): string {
  return `${basePath}?${READ_PARAM}=${encodeURIComponent(language)}`
}

interface PickParams {
  /** Все языки тайтла */
  available: string[]
  /** Основной язык тайтла (Originals — primaryLanguage; MangaDex — английский, если он есть) */
  primary?: string
  uiLang: string
  titleId: string
  /** Значение ?read= из URL, если есть */
  requested?: string | null
}

/**
 * Язык чтения по умолчанию: явный ?read= из ссылки -> сохранённый выбор ->
 * язык интерфейса, если у тайтла он есть -> основной язык тайтла.
 * Возвращает null только если у тайтла вообще нет языков.
 */
export function pickReadingLanguage({ available, primary, uiLang, titleId, requested }: PickParams): string | null {
  if (available.length === 0) return null
  const has = (l: string | null | undefined): l is string => !!l && available.includes(l)
  if (has(requested)) return requested
  const stored = getStoredReadingLanguage(titleId)
  if (has(stored)) return stored
  if (has(uiLang)) return uiLang
  if (has(primary)) return primary
  return sortLanguages(available)[0]
}
