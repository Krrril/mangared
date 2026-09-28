import flagGb from 'circle-flags/flags/gb.svg'
import flagRu from 'circle-flags/flags/ru.svg'
import flagKz from 'circle-flags/flags/kz.svg'
import flagEs from 'circle-flags/flags/es.svg'
import flagFr from 'circle-flags/flags/fr.svg'
import flagDe from 'circle-flags/flags/de.svg'
import flagTr from 'circle-flags/flags/tr.svg'
import flagKr from 'circle-flags/flags/kr.svg'
import flagCn from 'circle-flags/flags/cn.svg'
import flagJp from 'circle-flags/flags/jp.svg'

/*
  Языки чтения (контента) = наши 10 языков интерфейса (см.
  i18n/languages.ts, server/src/constants/languages.ts). Флаги — SVG из
  пакета circle-flags (не emoji: на Windows флаги-эмодзи не рендерятся).
  Для английского везде один вариант — GB (см. задачу), для китайского —
  CN, для казахского — KZ.
*/
export const CONTENT_LANGUAGES = ['ru', 'en', 'kk', 'es', 'fr', 'de', 'tr', 'ko', 'zh', 'ja'] as const
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number]

const FLAG_SRC: Record<ContentLanguage, string> = {
  ru: flagRu,
  en: flagGb,
  kk: flagKz,
  es: flagEs,
  fr: flagFr,
  de: flagDe,
  tr: flagTr,
  ko: flagKr,
  zh: flagCn,
  ja: flagJp,
}

export function isContentLanguage(code: unknown): code is ContentLanguage {
  return typeof code === 'string' && (CONTENT_LANGUAGES as readonly string[]).includes(code)
}

/**
 * Код языка -> один из наших 10 (для флага). Коды MangaDex шире наших:
 * 'es-la' (латиноамериканский испанский) показываем флагом Испании, всё
 * остальное вне наших 10 (pt-br, zh-hk, id, ...) — null, для таких
 * рисуется нейтральный значок с кодом (см. LanguageFlag).
 */
export function toContentLanguage(code: string): ContentLanguage | null {
  if (isContentLanguage(code)) return code
  if (code === 'es-la') return 'es'
  return null
}

export function flagSrcFor(code: string): string | null {
  const lang = toContentLanguage(code)
  return lang ? FLAG_SRC[lang] : null
}

const namesCache = new Map<string, Intl.DisplayNames | null>()

/** Название языка на языке интерфейса (Intl.DisplayNames — переводится на все 10 языков без ручных ключей). */
export function languageName(code: string, uiLang: string): string {
  let names = namesCache.get(uiLang)
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([uiLang], { type: 'language' })
    } catch {
      names = null
    }
    namesCache.set(uiLang, names)
  }
  const intlCode = code === 'es-la' ? 'es-419' : code
  try {
    return names?.of(intlCode) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

/**
 * Порядок показа: английский первым (читалка MangaDex исторически английская,
 * это разумный "основной" по умолчанию), затем остальные из наших 10 в их
 * порядке, затем прочие коды по алфавиту. Повторы убираются.
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
