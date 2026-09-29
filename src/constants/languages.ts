/*
  Языки чтения (контента). Наши 10 языков интерфейса (см. i18n/languages.ts,
  server/src/constants/languages.ts) — это языки, на которых можно публиковать
  авторские тайтлы (Originals). MangaDex же отдаёт переводы на десятках других
  языков, поэтому здесь ещё и реестр флагов: код языка -> флаг страны.

  Флаги — SVG из пакета circle-flags (не emoji: на Windows флаги-эмодзи не
  рендерятся), лежат в public/flags/<страна>.svg и подключаются по URL, чтобы
  не раздувать JS-бандл. Чтобы добавить новый язык, достаточно строки в
  LANGUAGE_FLAG и файла флага. Для английского везде один вариант — GB, для
  китайского — CN, для казахского — KZ, для латиноамериканского испанского
  (es-la) — нейтральный флаг Мексики. Языки без подходящего флага (эсперанто,
  романизации ja-ro/ko-ro/zh-ro) получают нейтральный значок с кодом.
*/
export const CONTENT_LANGUAGES = ['ru', 'en', 'kk', 'es', 'fr', 'de', 'tr', 'ko', 'zh', 'ja'] as const
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number]

const LANGUAGE_FLAG: Record<string, string> = {
  en: 'gb',
  ru: 'ru',
  kk: 'kz',
  es: 'es',
  'es-la': 'mx',
  fr: 'fr',
  de: 'de',
  tr: 'tr',
  ko: 'kr',
  zh: 'cn',
  'zh-hk': 'hk',
  ja: 'jp',
  'pt-br': 'br',
  pt: 'pt',
  id: 'id',
  it: 'it',
  sv: 'se',
  uk: 'ua',
  vi: 'vn',
  pl: 'pl',
  th: 'th',
  ar: 'sa',
  he: 'il',
  hi: 'in',
  ta: 'in',
  te: 'in',
  kn: 'in',
  ml: 'in',
  nl: 'nl',
  ro: 'ro',
  no: 'no',
  nb: 'no',
  da: 'dk',
  fi: 'fi',
  cs: 'cz',
  hu: 'hu',
  bg: 'bg',
  el: 'gr',
  ms: 'my',
  fa: 'ir',
  ka: 'ge',
  lt: 'lt',
  lv: 'lv',
  et: 'ee',
  sk: 'sk',
  sl: 'si',
  hr: 'hr',
  sr: 'rs',
  sq: 'al',
  az: 'az',
  be: 'by',
  bn: 'bd',
  my: 'mm',
  mn: 'mn',
  ne: 'np',
  ur: 'pk',
  la: 'va',
  ca: 'es-ct',
  tl: 'ph',
  fil: 'ph',
  sw: 'ke',
  uz: 'uz',
  tk: 'tm',
  ky: 'kg',
  tg: 'tj',
  af: 'za',
  ga: 'ie',
  ckb: 'iq',
}

export function isContentLanguage(code: unknown): code is ContentLanguage {
  return typeof code === 'string' && (CONTENT_LANGUAGES as readonly string[]).includes(code)
}

/** Код языка -> один из наших 10, если он есть (es-la показываем как испанский). */
export function toContentLanguage(code: string): ContentLanguage | null {
  if (isContentLanguage(code)) return code
  if (code === 'es-la') return 'es'
  return null
}

/** URL SVG-флага языка или null, если флага нет (тогда рисуется нейтральный значок с кодом, см. LanguageFlag). */
export function flagSrcFor(code: string): string | null {
  const country = LANGUAGE_FLAG[code.toLowerCase()]
  return country ? `/flags/${country}.svg` : null
}

const namesCache = new Map<string, Intl.DisplayNames | null>()

function displayNames(locale: string): Intl.DisplayNames | null {
  let names = namesCache.get(locale)
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([locale], { type: 'language' })
    } catch {
      names = null
    }
    namesCache.set(locale, names)
  }
  return names
}

function intlCode(code: string): string {
  return code === 'es-la' ? 'es-419' : code
}

/** Название языка на языке интерфейса (Intl.DisplayNames — переводится на все 10 языков без ручных ключей). */
export function languageName(code: string, uiLang: string): string {
  try {
    return displayNames(uiLang)?.of(intlCode(code)) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

/** Название языка на нём самом ("Deutsch", "Português (Brasil)") — по нему читатель узнаёт язык независимо от языка интерфейса. */
export function nativeLanguageName(code: string): string {
  const name = languageName(code, code.split('-')[0])
  // Intl пишет с маленькой буквы на ряде языков (español, français) — приводим к заглавной для списка.
  return name.charAt(0).toLocaleUpperCase(code.split('-')[0]) + name.slice(1)
}

/**
 * Порядок в списках выбора: язык интерфейса, затем наши 10 (в их порядке),
 * затем остальные по алфавиту (по названию на языке интерфейса). Повторы убираются.
 */
export function sortLanguagesFor(codes: string[], uiLang: string): string[] {
  const unique = [...new Set(codes)]
  const rank = (c: string): number => {
    if (c === uiLang) return 0
    const own = toContentLanguage(c)
    if (own && c !== 'es-la') return 1 + CONTENT_LANGUAGES.indexOf(own)
    return 100
  }
  return unique.sort((a, b) => {
    const d = rank(a) - rank(b)
    if (d !== 0) return d
    return languageName(a, uiLang).localeCompare(languageName(b, uiLang), uiLang)
  })
}

/**
 * Порядок без учёта языка интерфейса: английский первым (читалка MangaDex
 * исторически английская), затем остальные из наших 10, затем прочие по алфавиту кода.
 */
export function sortLanguages(codes: string[]): string[] {
  const unique = [...new Set(codes)]
  const rank = (c: string) => {
    if (c === 'en') return 0
    const lang = toContentLanguage(c)
    return lang ? 1 + CONTENT_LANGUAGES.indexOf(lang) : 100
  }
  return unique.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}
