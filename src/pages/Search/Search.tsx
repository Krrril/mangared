import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SearchX, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import TitleCard from '../../components/TitleCard'
import SeoHead from '../../components/SeoHead'
import { searchTitles } from '../../services/content'
import type { Title } from '../../services/content'
import { getStats } from '../../services/stats/api'
import type { TitleStats } from '../../services/stats/api'
import { searchAuthors } from '../../services/originals/api'
import type { AuthorSummary } from '../../services/originals/types'
import styles from './Search.module.css'

export default function Search() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const genreId = searchParams.get('genre') ?? ''
  const genreLabel = searchParams.get('label') ?? ''
  const { t } = useTranslation()

  const hasFilter = Boolean(query.trim() || genreId)
  const [results, setResults] = useState<Title[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Record<string, TitleStats>>({})
  const [people, setPeople] = useState<AuthorSummary[]>([])

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

  return (
    <MainLayout>
      <SeoHead title={t('seo.search.title')} description={t('seo.search.description')} />
      <h1 className={styles.heading}>{heading}</h1>

      {!hasFilter && (
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

      {hasFilter && !loading && results.length === 0 && people.length === 0 && (
        <div className={styles.state}>
          <SearchX size={40} />
          <p>{t('search.noResults', { query: query || genreLabel || genreId })}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className={styles.grid}>
          {results.map((title) => (
            <TitleCard key={title.id} title={title} stats={stats[title.id]} />
          ))}
        </div>
      )}
    </MainLayout>
  )
}
