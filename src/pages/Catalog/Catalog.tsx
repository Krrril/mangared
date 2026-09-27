import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Loader2, SearchX, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import SeoHead from '../../components/SeoHead'
import CatalogCard, { type CatalogItem } from '../../components/CatalogCard'
import { getCatalogPage } from '../../services/content'
import type { Title } from '../../services/content'
import { getPublicMangas } from '../../services/originals/api'
import type { MangaContentType, PublicManga } from '../../services/originals/types'
import { CURATED_GENRES, findGenreByMangadexTagId } from '../../constants/genres'
import { AGE_RATINGS, type SelectableAgeRating } from '../../constants/ageRating'
import styles from './Catalog.module.css'

type TypeTab = 'all' | 'manga' | 'manhwa' | 'manhua' | 'comic'
type SortKey = 'popular' | 'rating' | 'new'
type Direction = 'asc' | 'desc'

const TYPE_TABS: TypeTab[] = ['all', 'manga', 'manhwa', 'manhua', 'comic']
const SORT_KEYS: SortKey[] = ['popular', 'rating', 'new']
const MD_ORDER = { popular: 'followedCount', rating: 'rating', new: 'createdAt' } as const
// MangaDex определяет тип по языку оригинала (см. typeFromLanguage в mappers.ts).
const MD_LANGUAGES: Record<Exclude<TypeTab, 'all'>, string[]> = {
  manga: ['ja'],
  manhwa: ['ko'],
  manhua: ['zh', 'zh-hk'],
  comic: ['en'],
}

// Порция и для Originals (раскрываем по мере скролла), и для страницы MangaDex.
const PAGE_SIZE = 24
// Потолок MangaDex: offset + limit не может превышать 10000.
const MD_MAX_OFFSET = 10000

function sortOriginals(list: PublicManga[], sort: SortKey, dir: Direction): PublicManga[] {
  const sign = dir === 'asc' ? 1 : -1
  const score = (m: PublicManga) =>
    sort === 'new'
      ? new Date(m.createdAt ?? 0).getTime()
      : sort === 'rating'
        ? m.favoritesCount * 1_000_000 + m.viewsCount
        : m.viewsCount * 1_000_000 + m.favoritesCount
  return [...list].sort((a, b) => sign * (score(a) - score(b)))
}

/**
 * Общий каталог: сначала все Originals (наши авторы), затем MangaDex с
 * бесконечной подгрузкой. Скролл сначала раскрывает оставшиеся Originals
 * (они целиком приходят одним запросом — их немного), и только потом
 * начинает листать страницы MangaDex по offset.
 */
export default function Catalog() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const typeParam = searchParams.get('type') as TypeTab | null
  const type: TypeTab = typeParam && TYPE_TABS.includes(typeParam) ? typeParam : 'all'
  const sortParam = searchParams.get('sort') as SortKey | null
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'popular'
  const dir: Direction = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
  const genreId = findGenreByMangadexTagId(searchParams.get('genre') ?? '') ? (searchParams.get('genre') as string) : ''
  const ageParam = searchParams.get('ageRating') as SelectableAgeRating | null
  const ageRating: SelectableAgeRating | '' = ageParam && AGE_RATINGS.includes(ageParam) ? ageParam : ''

  const [filtersOpen, setFiltersOpen] = useState(Boolean(genreId || ageRating))
  const [originals, setOriginals] = useState<PublicManga[] | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [md, setMd] = useState<Title[]>([])
  const [mdDone, setMdDone] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)

  const requestId = useRef(0)
  const mdOffset = useRef(0)
  const busy = useRef(false)
  const seen = useRef(new Set<string>())
  const sentinelRef = useRef<HTMLDivElement>(null)

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setSearchParams(next, { replace: true })
  }

  // Смена любого фильтра/сортировки — начинаем ленту с нуля. requestId
  // отбрасывает ответы, пришедшие от предыдущей комбинации фильтров.
  useEffect(() => {
    const myRequest = ++requestId.current
    mdOffset.current = 0
    busy.current = false
    seen.current = new Set()
    setMd([])
    setMdDone(false)
    setFailed(false)
    setLoadingMore(false)
    setVisibleCount(PAGE_SIZE)
    setOriginals(null)

    // У Originals нет маньхуа — для этой вкладки авторских тайтлов просто нет.
    if (type === 'manhua') {
      setOriginals([])
      return
    }
    const curated = genreId ? findGenreByMangadexTagId(genreId) : undefined
    getPublicMangas({
      genres: curated ? [curated.slug] : undefined,
      ageRatings: ageRating ? [ageRating] : undefined,
      contentType: type === 'all' ? undefined : (type as MangaContentType),
    })
      .then((list) => {
        if (myRequest === requestId.current) setOriginals(list)
      })
      .catch(() => {
        if (myRequest === requestId.current) setOriginals([])
      })
  }, [type, sort, dir, genreId, ageRating])

  const sortedOriginals = useMemo(() => sortOriginals(originals ?? [], sort, dir), [originals, sort, dir])

  const loadMore = useCallback(async () => {
    if (originals === null || busy.current || failed) return
    if (visibleCount < sortedOriginals.length) {
      setVisibleCount((c) => c + PAGE_SIZE)
      return
    }
    if (mdDone) return

    busy.current = true
    setLoadingMore(true)
    const myRequest = requestId.current
    try {
      const { titles, total } = await getCatalogPage({
        offset: mdOffset.current,
        limit: PAGE_SIZE,
        order: MD_ORDER[sort],
        direction: dir,
        originalLanguages: type === 'all' ? undefined : MD_LANGUAGES[type],
        includedTags: genreId ? [genreId] : undefined,
      })
      if (myRequest !== requestId.current) return
      mdOffset.current += PAGE_SIZE
      const fresh = titles.filter((title) => !seen.current.has(title.id))
      fresh.forEach((title) => seen.current.add(title.id))
      setMd((prev) => [...prev, ...fresh])
      if (titles.length === 0 || mdOffset.current >= Math.min(total, MD_MAX_OFFSET)) setMdDone(true)
    } catch {
      if (myRequest === requestId.current) setFailed(true)
    } finally {
      if (myRequest === requestId.current) {
        busy.current = false
        setLoadingMore(false)
      }
    }
  }, [originals, failed, visibleCount, sortedOriginals.length, mdDone, sort, dir, type, genreId])

  // Подгружаем, пока «якорь» под сеткой в зоне видимости (запас 600px) —
  // одного IntersectionObserver мало: если после порции якорь всё ещё на
  // экране (высокий монитор), нового пересечения не будет (см. также
  // scroll/resize ниже).
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || originals === null || failed) return
    const check = () => {
      if (el.getBoundingClientRect().top < window.innerHeight + 600) void loadMore()
    }
    check()
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && check(), { rootMargin: '600px' })
    observer.observe(el)
    // Страховка: scroll/resize — на случай, если IntersectionObserver не сработал (фоновая вкладка, экзотический браузер).
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [loadMore, originals, failed, md.length, visibleCount])

  const items: CatalogItem[] = useMemo(() => {
    const shown = sortedOriginals.slice(0, visibleCount)
    const list: CatalogItem[] = shown.map((manga) => ({ kind: 'original', manga }))
    if (visibleCount >= sortedOriginals.length) md.forEach((title) => list.push({ kind: 'mangadex', title }))
    return list
  }, [sortedOriginals, visibleCount, md])

  const activeFilters = (genreId ? 1 : 0) + (ageRating ? 1 : 0)
  const ready = originals !== null
  const showEmpty = ready && items.length === 0 && mdDone && !loadingMore
  const showEnd = ready && mdDone && items.length > 0 && visibleCount >= sortedOriginals.length

  return (
    <MainLayout>
      <SeoHead title={t('seo.catalog.title')} description={t('seo.catalog.description')} />
      <h1 className={styles.heading}>{t('catalog.title')}</h1>

      <div className={styles.controls}>
        <label className={styles.sortWrap}>
          <span className={styles.sortLabel}>{t('catalog.sortLabel')}</span>
          <select className={styles.select} value={sort} onChange={(e) => updateParams({ sort: e.target.value === 'popular' ? null : e.target.value })}>
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(`catalog.sort${k.charAt(0).toUpperCase()}${k.slice(1)}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => updateParams({ dir: dir === 'desc' ? 'asc' : null })}
          aria-label={dir === 'desc' ? t('catalog.sortDesc') ?? '' : t('catalog.sortAsc') ?? ''}
          title={dir === 'desc' ? t('catalog.sortDesc') ?? '' : t('catalog.sortAsc') ?? ''}
        >
          {dir === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
        </button>
        <button
          type="button"
          className={`${styles.filtersButton} ${filtersOpen ? styles.filtersButtonActive : ''}`}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal size={15} />
          {t('catalog.filters')}
          {activeFilters > 0 && <span className={styles.filtersCount}>{activeFilters}</span>}
        </button>
      </div>

      <div className={styles.tabs}>
        {TYPE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={type === tab ? styles.tabActive : styles.tab}
            onClick={() => updateParams({ type: tab === 'all' ? null : tab })}
          >
            {tab === 'all' ? t('catalog.tabAll') : t(`creator.contentType.${tab}`)}
          </button>
        ))}
      </div>

      {filtersOpen && (
        <div className={styles.filtersPanel}>
          <p className={styles.filterHeading}>{t('catalog.genreHeading')}</p>
          <div className={styles.chips}>
            {CURATED_GENRES.map((g) => (
              <button
                key={g.id}
                type="button"
                className={genreId === g.mangadexTagId ? styles.chipActive : styles.chip}
                onClick={() => updateParams({ genre: genreId === g.mangadexTagId ? null : g.mangadexTagId })}
              >
                {t(`genres.${g.id}`)}
              </button>
            ))}
          </div>
          <p className={styles.filterHeading}>{t('catalog.ratingHeading')}</p>
          <div className={styles.chips}>
            {AGE_RATINGS.map((r) => (
              <button
                key={r}
                type="button"
                className={ageRating === r ? styles.chipActive : styles.chip}
                onClick={() => updateParams({ ageRating: ageRating === r ? null : r })}
              >
                {t(`ageRating.${r}`)}
              </button>
            ))}
          </div>
          {activeFilters > 0 && (
            <button type="button" className={styles.resetButton} onClick={() => updateParams({ genre: null, ageRating: null })}>
              {t('catalog.filtersReset')}
            </button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className={styles.grid}>
          {items.map((item) => (
            <CatalogCard key={item.kind === 'original' ? `o-${item.manga.id}` : `m-${item.title.id}`} item={item} />
          ))}
        </div>
      )}

      {showEmpty && (
        <div className={styles.state}>
          <SearchX size={40} />
          <p>{t('catalog.empty')}</p>
        </div>
      )}

      {failed && (
        <div className={styles.state}>
          <p>{t('catalog.loadError')}</p>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => {
              setFailed(false)
            }}
          >
            {t('catalog.retry')}
          </button>
        </div>
      )}

      <div ref={sentinelRef} className={styles.sentinel}>
        {(!ready || loadingMore) && !failed && <Loader2 size={22} className={styles.spinner} aria-label={t('common.loading') ?? ''} />}
        {showEnd && <p className={styles.end}>{t('catalog.endOfList')}</p>}
      </div>
    </MainLayout>
  )
}
