import { prisma } from '../db.js'
import { CURATED_GENRES } from '../constants/genres.js'

/*
  Картинки для карточек категорий/жанров (см. Categories.tsx, Home.tsx) —
  обложка популярного тайтла с этим жанром, среди обоих источников
  контента разом (MangaDex + Originals). "Популярность" сравнивается по
  числу, которое у каждого источника СВОЁ: у MangaDex — число подписчиков
  (follows, через /statistics/manga), у Originals — сумма просмотров и
  избранного (TitleStats). Это не откалиброванные друг под друга шкалы
  (MangaDex обычно на порядки больше) — при нынешнем размере каталога
  Originals почти наверняка проигрывает сравнение почти везде,
  и это ожидаемо, не баг: по мере роста каталога Originals картинки
  будут естественным образом смещаться в его сторону там, где он
  реально наберёт сопоставимую популярность.

  Каждая картинка используется только ОДИН раз на весь список категорий
  (см. баг: несколько жанров показывали одну и ту же обложку, потому что
  один тайтл с несколькими тегами — например, "Фэнтези"+"Экшен"+
  "Приключения" — побеждал как "самый популярный" сразу для всех них).
  Для этого каждый жанр хранит не одного кандидата, а ранжированный пул
  (CANDIDATE_LIMIT штук) — если лучший уже занят другим жанром, берём
  следующего по популярности уникального. См. computeCategoryImages.
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
// Сколько кандидатов держим на жанр (оба источника вместе) — запас на
// случай, если топ-кандидаты по цепочке окажутся заняты другими жанрами.
const CANDIDATE_LIMIT = 8

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
  source: 'mangadex' | 'original'
}

async function fetchMangaDexCandidates(tagId: string): Promise<Candidate[]> {
  const params = new URLSearchParams()
  params.set('limit', String(CANDIDATE_LIMIT))
  params.append('includedTags[]', tagId)
  params.append('order[followedCount]', 'desc')
  params.append('includes[]', 'cover_art')
  params.append('availableTranslatedLanguage[]', CONTENT_LANGUAGE)
  for (const rating of CONTENT_RATINGS) params.append('contentRating[]', rating)

  try {
    const res = await fetch(`${MANGADEX_BASE}/manga?${params.toString()}`)
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: { id: string; attributes?: { title?: Record<string, string> }; relationships?: { type: string; attributes?: { fileName?: string } }[] }[]
    }
    const mangas = json.data ?? []
    if (mangas.length === 0) return []

    // Один батч-запрос на все кандидаты сразу (тот же принцип, что и
    // раньше для одного кандидата) — не N+1 запросов.
    let follows: Record<string, number> = {}
    try {
      const statsParams = new URLSearchParams()
      for (const manga of mangas) statsParams.append('manga[]', manga.id)
      const statsRes = await fetch(`${MANGADEX_BASE}/statistics/manga?${statsParams.toString()}`)
      if (statsRes.ok) {
        const statsJson = (await statsRes.json()) as { statistics?: Record<string, { follows?: number }> }
        for (const [id, entry] of Object.entries(statsJson.statistics ?? {})) {
          follows[id] = entry.follows ?? 0
        }
      }
    } catch {
      // Число подписчиков не критично для самой картинки — сравнение просто пойдёт с 0.
    }

    const candidates: Candidate[] = []
    for (const manga of mangas) {
      const coverRel = manga.relationships?.find((r) => r.type === 'cover_art')
      const fileName = coverRel?.attributes?.fileName
      if (!fileName) continue

      const titleMap = manga.attributes?.title ?? {}
      const titleName = titleMap.en ?? Object.values(titleMap)[0] ?? ''

      candidates.push({
        // .256 — тот же размер, что и у обычных обложек в мелких карточках
        // (см. src/services/content/mappers.ts, coverUrl: getCoverUrl(manga,
        // 256)); плитка категории отображается похожего размера, .512 был
        // избыточен (см. задачу про LCP/сетевой вес на мобильных).
        imageUrl: `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg`,
        titleId: manga.id,
        titleName,
        score: follows[manga.id] ?? 0,
        source: 'mangadex',
      })
    }
    return candidates.sort((a, b) => b.score - a.score)
  } catch {
    return []
  }
}

async function fetchOriginalsCandidates(slug: string): Promise<Candidate[]> {
  const mangas = await prisma.userManga.findMany({
    where: { status: 'published', genres: { has: slug }, coverUrl: { not: null } },
    select: { id: true, title: true, coverUrl: true },
  })
  if (mangas.length === 0) return []

  const stats = await prisma.titleStats.findMany({ where: { mangaId: { in: mangas.map((m) => m.id) } } })
  const scoreById = new Map(stats.map((s) => [s.mangaId, s.viewsCount + s.favoritesCount]))

  return mangas
    .filter((m): m is typeof m & { coverUrl: string } => !!m.coverUrl)
    .map((m) => ({
      imageUrl: m.coverUrl,
      titleId: m.id,
      titleName: m.title,
      score: scoreById.get(m.id) ?? 0,
      source: 'original' as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_LIMIT)
}

async function computeCategoryImages(): Promise<CategoryImage[]> {
  const perGenre = await Promise.all(
    CURATED_GENRES.map(async (genre) => {
      const [md, orig] = await Promise.all([fetchMangaDexCandidates(genre.mangadexTagId), fetchOriginalsCandidates(genre.slug)])
      const candidates = [...md, ...orig].sort((a, b) => b.score - a.score)
      return { genre, candidates }
    }),
  )

  // Закрепляем картинки в порядке убывания "отрыва" топ-кандидата от
  // второго по популярности — там, где разрыв большой, выбор очевиден и
  // его не стоит терять из-за жадного перебора по порядку списка жанров
  // (иначе жанр, что просто раньше в списке, может отобрать тайтл у
  // жанра, для которого этот тайтл — единственный явный лидер). Жанр с
  // единственным кандидатом или без конкурентов по счёту тоже "уверенный"
  // — отрыв считаем от 0.
  const withGap = perGenre.map(({ genre, candidates }) => {
    const gap = candidates.length === 0 ? -1 : candidates.length === 1 ? candidates[0].score : candidates[0].score - candidates[1].score
    return { genre, candidates, gap }
  })
  withGap.sort((a, b) => b.gap - a.gap)

  const usedTitleIds = new Set<string>()
  const resultByGenreId = new Map<string, CategoryImage>()

  for (const { genre, candidates } of withGap) {
    const winner = candidates.find((c) => !usedTitleIds.has(c.titleId))
    if (!winner) continue // все кандидаты уже разобраны другими жанрами — редкий край, жанр просто без картинки
    usedTitleIds.add(winner.titleId)
    resultByGenreId.set(genre.id, {
      genreId: genre.id,
      genreSlug: genre.slug,
      imageUrl: winner.imageUrl,
      titleId: winner.titleId,
      titleName: winner.titleName,
      source: winner.source,
    })
  }

  // Отдаём в исходном порядке CURATED_GENRES — порядок карточек на
  // странице не должен зависеть от внутренней эвристики закрепления.
  return CURATED_GENRES.map((g) => resultByGenreId.get(g.id)).filter((r): r is CategoryImage => r !== undefined)
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
