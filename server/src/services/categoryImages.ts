import { prisma } from '../db.js'
import { CURATED_GENRES } from '../constants/genres.js'

/*
  Картинки для карточек категорий/жанров (см. Categories.tsx, Home.tsx) —
  обложка САМОГО ПОПУЛЯРНОГО тайтла с этим жанром, среди обоих источников
  контента разом (MangaDex + Originals). "Популярность" сравнивается по
  числу, которое у каждого источника СВОЁ: у MangaDex — число подписчиков
  (follows, через /statistics/manga), у Originals — сумма просмотров и
  избранного (TitleStats). Это не откалиброванные друг под друга шкалы
  (MangaDex обычно на порядки больше) — при нынешнем размере каталога
  Originals почти наверняка проигрывает сравнение почти везде,
  и это ожидаемо, не баг: по мере роста каталога Originals картинки
  будут естественным образом смещаться в его сторону там, где он
  реально наберёт сопоставимую популярность.
*/

const MANGADEX_BASE = 'https://api.mangadex.org'
// Те же значения, что и на фронтенде (см. src/api/mangadex/constants.ts) —
// бэкенд обращается к MangaDex напрямую (сервер-сервер, CORS ни при чём),
// но фильтры контента должны совпадать с тем, что видит сайт везде.
const CONTENT_RATINGS = ['safe', 'suggestive']
const CONTENT_LANGUAGE = 'en'
// Раз в сутки, как предпочёл пользователь в задаче — не пересчитывать на
// каждый визит. Кэш в памяти процесса: он и так переживает рестарт
// достаточно редко на Render, а после холодного старта просто посчитается
// заново один раз, это не проблема при такой периодичности.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface CategoryImage {
  genreId: string
  genreSlug: string
  imageUrl: string
  titleId: string
  titleName: string
  source: 'mangadex' | 'original'
}

interface Candidate {
  imageUrl: string
  titleId: string
  titleName: string
  score: number
}

async function fetchMangaDexCandidate(tagId: string): Promise<Candidate | null> {
  const params = new URLSearchParams()
  params.set('limit', '1')
  params.append('includedTags[]', tagId)
  params.append('order[followedCount]', 'desc')
  params.append('includes[]', 'cover_art')
  params.append('availableTranslatedLanguage[]', CONTENT_LANGUAGE)
  for (const rating of CONTENT_RATINGS) params.append('contentRating[]', rating)

  try {
    const res = await fetch(`${MANGADEX_BASE}/manga?${params.toString()}`)
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { id: string; attributes?: { title?: Record<string, string> }; relationships?: { type: string; attributes?: { fileName?: string } }[] }[]
    }
    const manga = json.data?.[0]
    if (!manga) return null

    const coverRel = manga.relationships?.find((r) => r.type === 'cover_art')
    const fileName = coverRel?.attributes?.fileName
    if (!fileName) return null

    const titleMap = manga.attributes?.title ?? {}
    const titleName = titleMap.en ?? Object.values(titleMap)[0] ?? ''

    // order[followedCount] уже отдал самого популярного, но не само
    // число — оно отдельно нужно, чтобы было с чем сравнивать Originals.
    let follows = 0
    try {
      const statsRes = await fetch(`${MANGADEX_BASE}/statistics/manga?manga[]=${manga.id}`)
      if (statsRes.ok) {
        const statsJson = (await statsRes.json()) as { statistics?: Record<string, { follows?: number }> }
        follows = statsJson.statistics?.[manga.id]?.follows ?? 0
      }
    } catch {
      // Число подписчиков не критично для самой картинки — сравнение просто пойдёт с 0.
    }

    return {
      imageUrl: `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.512.jpg`,
      titleId: manga.id,
      titleName,
      score: follows,
    }
  } catch {
    return null
  }
}

async function fetchOriginalsCandidate(slug: string): Promise<Candidate | null> {
  const mangas = await prisma.userManga.findMany({
    where: { status: 'published', genres: { has: slug }, coverUrl: { not: null } },
    select: { id: true, title: true, coverUrl: true },
  })
  if (mangas.length === 0) return null

  const stats = await prisma.titleStats.findMany({ where: { mangaId: { in: mangas.map((m) => m.id) } } })
  const scoreById = new Map(stats.map((s) => [s.mangaId, s.viewsCount + s.favoritesCount]))

  let best: (typeof mangas)[number] | null = null
  let bestScore = -1
  for (const m of mangas) {
    const score = scoreById.get(m.id) ?? 0
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }
  if (!best?.coverUrl) return null

  return { imageUrl: best.coverUrl, titleId: best.id, titleName: best.title, score: bestScore }
}

async function computeCategoryImages(): Promise<CategoryImage[]> {
  const results = await Promise.all(
    CURATED_GENRES.map(async (genre) => {
      const [mdCandidate, originalCandidate] = await Promise.all([
        fetchMangaDexCandidate(genre.mangadexTagId),
        fetchOriginalsCandidate(genre.slug),
      ])

      const winner =
        mdCandidate && originalCandidate
          ? mdCandidate.score >= originalCandidate.score
            ? { ...mdCandidate, source: 'mangadex' as const }
            : { ...originalCandidate, source: 'original' as const }
          : mdCandidate
            ? { ...mdCandidate, source: 'mangadex' as const }
            : originalCandidate
              ? { ...originalCandidate, source: 'original' as const }
              : null

      if (!winner) return null
      const image: CategoryImage = {
        genreId: genre.id,
        genreSlug: genre.slug,
        imageUrl: winner.imageUrl,
        titleId: winner.titleId,
        titleName: winner.titleName,
        source: winner.source,
      }
      return image
    }),
  )
  return results.filter((r): r is CategoryImage => r !== null)
}

let cache: { data: CategoryImage[]; computedAt: number } | null = null
let inflight: Promise<CategoryImage[]> | null = null

/** Кэшируется на CACHE_TTL_MS — не пересчитывать на каждый визит (см. задачу). */
export async function getCategoryImages(): Promise<CategoryImage[]> {
  const now = Date.now()
  if (cache && now - cache.computedAt < CACHE_TTL_MS) return cache.data
  // Одновременные визиты в момент истечения кэша не должны каждый
  // запускать свой пересчёт — дожидаются одного и того же промиса.
  if (inflight) return inflight

  inflight = computeCategoryImages()
    .then((data) => {
      cache = { data, computedAt: Date.now() }
      return data
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}
