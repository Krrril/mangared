import { CURATED_GENRES } from '../constants/genres.js'
import type { TelegramLang } from './telegram.js'

/*
  Тексты постов в канале. Язык — TELEGRAM_POST_LANG (ru по умолчанию, en).
  Названия жанров Originals — курируемый список (constants/genres.ts), русские
  подписи те же, что и на сайте (locales/ru.json, genres.*).
*/

const RU_GENRES: Record<string, string> = {
  romance: 'Романтика',
  comedy: 'Комедия',
  fantasy: 'Фэнтези',
  action: 'Экшен',
  adventure: 'Приключения',
  drama: 'Драма',
  isekai: 'Исекай',
  sliceOfLife: 'Повседневность',
  tragedy: 'Трагедия',
  psychological: 'Психологическое',
  sciFi: 'Sci-Fi',
  mystery: 'Детектив',
  horror: 'Хоррор',
  girlsLove: 'Юри',
  thriller: 'Триллер',
}

/** Название жанра по slug (английское имя тега) и, для MangaDex, по id тега. */
export function genreLabel(slugOrTagId: string, lang: TelegramLang): string {
  const curated = CURATED_GENRES.find((g) => g.slug === slugOrTagId || g.mangadexTagId === slugOrTagId)
  if (!curated) return slugOrTagId
  return lang === 'ru' ? (RU_GENRES[curated.id] ?? curated.slug) : curated.slug
}

export function languageName(code: string, lang: TelegramLang): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export function pluralChapters(n: number, lang: TelegramLang): string {
  if (lang === 'en') return `${n} ${n === 1 ? 'chapter' : 'chapters'}`
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} глава`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} главы`
  return `${n} глав`
}

/**
 * Заголовок подборки (только первое сообщение): {date} — дата подборки.
 * Меняется здесь, без правки логики. Язык — TELEGRAM_POST_LANG.
 */
export const DIGEST_HEADER: Record<TelegramLang, string> = {
  ru: '🆕 Новинки · {date}',
  en: '🆕 New releases · {date}',
}

/** Дата подборки словами ("8 ноября" / "November 8"), по UTC. */
export function formatDigestDate(date: Date, lang: TelegramLang): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)
}

export function digestHeader(lang: TelegramLang, date = new Date()): string {
  return DIGEST_HEADER[lang].replace('{date}', formatDigestDate(date, lang))
}

export const TEXTS = {
  ru: {
    newTitle: '🆕 Новый тайтл на MangaGreen',
    author: 'Автор',
    genres: 'Жанры',
    age: 'Возраст',
    language: 'Язык',
    newChapter: '📖 Новая глава',
    newChapters: '📖 Новые главы',
    chapterWord: 'глава',
    chaptersWord: 'главы',
    read: 'Читать',
    source: 'Источник: MangaDex',
    testMessage: '✅ Тестовое сообщение MangaGreen: бот подключён к каналу.',
    testDigestHeader: '🧪 Тестовая подборка',
  },
  en: {
    newTitle: '🆕 New title on MangaGreen',
    author: 'Author',
    genres: 'Genres',
    age: 'Age',
    language: 'Language',
    newChapter: '📖 New chapter',
    newChapters: '📖 New chapters',
    chapterWord: 'chapter',
    chaptersWord: 'chapters',
    read: 'Read',
    source: 'Source: MangaDex',
    testMessage: '✅ MangaGreen test message: the bot is connected to the channel.',
    testDigestHeader: '🧪 Test digest',
  },
} as const

export type Texts = (typeof TEXTS)[TelegramLang]
