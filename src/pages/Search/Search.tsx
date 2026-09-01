import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SearchX, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import TitleCard from '../../components/TitleCard'
import OriginalCard from '../../components/OriginalCard'
import SeoHead from '../../components/SeoHead'
import { searchTitles } from '../../services/content'
import type { Title } from '../../services/content'
import { getStats } from '../../services/stats/api'
import type { TitleStats } from '../../services/stats/api'
import { getPublicMangas, searchAuthors } from '../../services/originals/api'
import type { AuthorSummary, PublicManga } from '../../services/originals/types'
import { CURATED_GENRES, findGenreByMangadexTagId } from '../../constants/genres'
import { AGE_RATINGS, type SelectableAgeRating } from '../../constants/ageRating'
import styles from './Search.module.css'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const genreId = searchParams.get('genre') ?? ''
  const genreLabel = searchParams.get('label') ?? ''
  const { t } = useTranslation()

  // Рейтинг относится только к Originals (см. задачу 3, "для MangaDex не
  // нужен") — свой отдельный query-параметр, не завязан на genre/label,
  // которые общие с переходом по чипу жанра из /categories (см. CategoryChip.tsx).
  const ageRating = (searchParams.get('ageRating') as SelectableAgeRating | null) ?? ''

  const hasFilter = Boolean(query.trim() || genreId)
  const [results, setResults] = useState<Title[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Record<string, TitleStats>>({})
  const [people, setPeople] = useState<AuthorSummary[]>([])
  const [originalsResults, setOriginalsResults] = useState<PublicManga[]>([])

  useEffect(() => {
    if (!hasFilter) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    searchTitles({ query, genreId: genreId || undefined }).then((titles) => {
      if (cancelled) return
      setResults(titles)
      setLoading(false)
      getStats(titles.map((t) => t.id)).then((s) => {
        if (!cancelled) setStats(s)
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, genreId])

  // Originals ищутся только по жанру/рейтингу (курируемый список — см.
  // constants/genres.ts), не по тексту: полнотекстовый поиск по Originals —
  // отдельная, более крупная задача, тут делаем ровно то, что просили —
  // фильтр по жанру/рейтингу, охватывающий оба источника контента.
  useEffect(() => {
    const curated = genreId ? findGenreByMangadexTagId(genreId) : undefined
    if (!curated && !ageRating) {
      setOriginalsResults([])
      return
    }
    let cancelled = false
    getPublicMangas({
      genres: curated ? [curated.slug] : undefined,
      ageRatings: ageRating ? [ageRating] : undefined,
    }).then((mangas) => {
      if (!cancelled) setOriginalsResults(mangas)
    })
    return () => {
      cancelled = true
    }
  }, [genreId, ageRating])

  function handleGenreChange(mangadexTagId: string) {
    const next = new URLSearchParams(searchParams)
    if (mangadexTagId) {
      const genre = CURATED_GENRES.find((g) => g.mangadexTagId === mangadexTagId)
      next.set('genre', mangadexTagId)
      next.set('label', genre ? t(`genres.${genre.id}`) : '')
    } else {
      next.delete('genre')
      next.delete('label')
    }
    setSearchParams(next)
  }

  function handleAgeRatingChange(rating: string) {
    const next = new URLSearchParams(searchParams)
    if (rating) next.set('ageRating', rating)
    else next.delete('ageRating')
    setSearchParams(next)
  }

  // Поиск пользователей — только по текстовому запросу (жанр не имеет
  // отношения к юзернеймам), не блокирует загрузку тайтлов — независимый эффект.
  useEffect(() => {
    if (!query.trim()) {
      setPeople([])
      return
    }
    let cancelled = false
    searchAuthors(query).then((rows) => {
      if (!cancelled) setPeople(rows)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  const heading = query
    ? `${t('search.resultsFor')} «${query}»`
    : genreId
      ? `${t('search.resultsFor')} «${genreLabel || genreId}»`
      : t('search.title')

  const hasAnyFilter = hasFilter || Boolean(ageRating)

  return (
    <MainLayout>
      <SeoHead title={t('seo.search.title')} description={t('seo.search.description')} />
      <h1 className={styles.heading}>{heading}</h1>

      <div className={styles.filterRow}>
        <select className={styles.filterSelect} value={genreId} onChange={(e) => handleGenreChange(e.target.value)}>
          <option value="">{t('search.allGenres')}</option>
          {CURATED_GENRES.map((g) => (
            <option key={g.mangadexTagId} value={g.mangadexTagId}>
              {t(`genres.${g.id}`)}
            </option>
          ))}
        </select>
        <select className={styles.filterSelect} value={ageRating} onChange={(e) => handleAgeRatingChange(e.target.value)}>
          <option value="">{t('search.allRatingsOriginals')}</option>
          {AGE_RATINGS.map((r) => (
            <option key={r} value={r}>
              {t(`ageRating.${r}`)}
            </option>
          ))}
        </select>
      </div>

      {!hasAnyFilter && (
        <div className={styles.state}>
          <SearchIcon size={40} />
          <p>{t('search.prompt')}</p>
        </div>
      )}

      {people.length > 0 && (
        <div className={styles.peopleRow}>
          {people.map((author) => (
            <Link key={author.id} to={`/author/${author.username}`} className={styles.personCard}>
              <span className={styles.personAvatar}>
                {author.avatarUrl ? <img src={author.avatarUrl} alt="" referrerPolicy="no-referrer" /> : author.displayName.charAt(0).toUpperCase()}
              </span>
              <span className={styles.personName}>{author.displayName}</span>
              <span className={styles.personUsername}>@{author.username}</span>
            </Link>
          ))}
        </div>
      )}

      {hasFilter && loading && <p className={styles.loading}>{t('common.loading')}</p>}

      {hasAnyFilter && !loading && results.length === 0 && people.length === 0 && originalsResults.length === 0 && (
        <div className={styles.state}>
          <SearchX size={40} />
          <p>{t('search.noResults', { query: query || genreLabel || genreId })}</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          {originalsResults.length > 0 && <h2 className={styles.sourceHeading}>{t('search.mangadexSection')}</h2>}
          <div className={styles.grid}>
            {results.map((title) => (
              <TitleCard key={title.id} title={title} stats={stats[title.id]} />
            ))}
          </div>
        </>
      )}

      {originalsResults.length > 0 && (
        <>
          <h2 className={styles.sourceHeading}>{t('search.originalsSection')}</h2>
          <div className={styles.grid}>
            {originalsResults.map((manga) => (
              <OriginalCard key={manga.id} manga={manga} />
            ))}
          </div>
        </>
      )}
    </MainLayout>
  )
}
