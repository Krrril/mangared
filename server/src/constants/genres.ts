/*
  Курируемый список жанров для Originals — введён вместо свободного текста
  (см. сессию про фидбек от Siva, задача 2), чтобы фильтрация по жанру
  работала одинаково для Originals и для каталога MangaDex (задача 3).
  slug — то, что реально хранится в UserManga.genres[] — специально
  совпадает СИМВОЛ В СИМВОЛ с английским названием тега на MangaDex
  (tag.attributes.name.en), иначе фильтр "Sci-Fi" на Originals и "Sci-Fi"
  на MangaDex были бы двумя разными строками. mangadexTagId — id этого же
  тега в MangaDex API (см. GET /manga/tag), нужен только для фильтрации
  каталога MangaDex по этому жанру (см. routes для поиска на фронте).

  Список — топ-15 по частоте встречаемости жанра среди 400 самых
  популярных тайтлов MangaDex (order[followedCount]=desc, выборка снята
  вручную при разработке этой фичи, см. историю сессии) — не придуман
  вручную, чтобы отражать реальное распределение, а не догадку.
*/

export interface CuratedGenre {
  /** Безопасный ключ для React key / i18n (никаких пробелов и апострофов) — НЕ хранится в БД. */
  id: string
  /** Ровно то, что лежит в UserManga.genres[] и совпадает с MangaDex tag.attributes.name.en. */
  slug: string
  /** id жанрового тега в MangaDex API — для фильтрации каталога MangaDex по тому же жанру. */
  mangadexTagId: string
}

export const CURATED_GENRES: CuratedGenre[] = [
  { id: 'romance', slug: 'Romance', mangadexTagId: '423e2eae-a7a2-4a8b-ac03-a8351462d71d' },
  { id: 'comedy', slug: 'Comedy', mangadexTagId: '4d32cc48-9f00-4cca-9b5a-a839f0764984' },
  { id: 'fantasy', slug: 'Fantasy', mangadexTagId: 'cdc58593-87dd-415e-bbc0-2ec27bf404cc' },
  { id: 'action', slug: 'Action', mangadexTagId: '391b0423-d847-456f-aff0-8b0cfc03066b' },
  { id: 'adventure', slug: 'Adventure', mangadexTagId: '87cc87cd-a395-47af-b27a-93258283bbc6' },
  { id: 'drama', slug: 'Drama', mangadexTagId: 'b9af3a63-f058-46de-a9a0-e0c13906197a' },
  { id: 'isekai', slug: 'Isekai', mangadexTagId: 'ace04997-f6bd-436e-b261-779182193d3d' },
  { id: 'sliceOfLife', slug: 'Slice of Life', mangadexTagId: 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9' },
  { id: 'tragedy', slug: 'Tragedy', mangadexTagId: 'f8f62932-27da-4fe4-8ee1-6779a8c5edba' },
  { id: 'psychological', slug: 'Psychological', mangadexTagId: '3b60b75c-a2d7-4860-ab56-05f391bb889c' },
  { id: 'sciFi', slug: 'Sci-Fi', mangadexTagId: '256c8bd9-4904-4360-bf4f-508a76d67183' },
  { id: 'mystery', slug: 'Mystery', mangadexTagId: 'ee968100-4191-4968-93d3-f82d72be7e46' },
  { id: 'horror', slug: 'Horror', mangadexTagId: 'cdad7e68-1419-41dd-bdce-27753074a640' },
  { id: 'girlsLove', slug: "Girls' Love", mangadexTagId: 'a3c67850-4684-404e-9b7f-c69850ee5da6' },
  { id: 'thriller', slug: 'Thriller', mangadexTagId: '07251805-a27e-4d59-b488-f0bfbec15168' },
]

export const CURATED_GENRE_SLUGS = CURATED_GENRES.map((g) => g.slug) as [string, ...string[]]
