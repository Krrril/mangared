/*
  Раньше ходили напрямую на api.mangadex.org из браузера — но на реальном
  домене (Vercel) MangaDex перестал отдавать CORS-заголовок для наших
  запросов (см. DECISIONS.md), хотя локально это работало. Поэтому JSON-
  запросы идут через прокси на нашем backend (server/src/routes/mangadex.ts),
  где CORS ни при чём — это уже запрос сервер-сервер.
*/
const BACKEND_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
export const API_BASE = `${BACKEND_BASE}/mangadex`

/*
  Обложки и страницы глав — обычные <img src="...">, не fetch(), поэтому
  CORS их не касается вообще — грузим их напрямую с серверов MangaDex,
  как и раньше.
*/
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
