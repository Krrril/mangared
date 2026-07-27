export const API_BASE = 'https://api.mangadex.org'
export const COVER_BASE = 'https://uploads.mangadex.org/covers'

/*
  Контент-рейтинг MangaDex: safe / suggestive / erotica / pornographic.
  MangaRed на MVP показывает только safe+suggestive — без explicit-контента.
*/
export const CONTENT_RATINGS = ['safe', 'suggestive'] as const

/*
  Язык контента (перевод глав) — отдельная сущность от языка интерфейса
  (см. src/i18n). Пока читаем только английские переводы: у них на
  MangaDex самое широкое покрытие. Переключение языка контента — задача
  на будущее (см. docs/ROADMAP.md).
*/
export const CONTENT_LANGUAGE = 'en'
