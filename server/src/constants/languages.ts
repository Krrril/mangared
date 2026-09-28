/*
  Языки контента Originals = наши 10 языков интерфейса (зеркало
  src/i18n/languages.ts на фронтенде — проекты раздельные, общего пакета
  нет, см. остальные дублированные константы вроде genres.ts/ageRating.ts).
  Порядок — порядок показа в списках выбора языка.
*/
export const APP_LANGUAGE_CODES = ['ru', 'en', 'kk', 'es', 'fr', 'de', 'tr', 'ko', 'zh', 'ja'] as const
export type AppLanguageCode = (typeof APP_LANGUAGE_CODES)[number]

export function isAppLanguage(value: unknown): value is AppLanguageCode {
  return typeof value === 'string' && (APP_LANGUAGE_CODES as readonly string[]).includes(value)
}

/** Основной язык первым, остальные — в порядке APP_LANGUAGE_CODES, без повторов. */
export function orderLanguages(primary: string, others: Iterable<string>): string[] {
  const set = new Set(others)
  set.delete(primary)
  return [primary, ...APP_LANGUAGE_CODES.filter((c) => set.has(c))]
}
