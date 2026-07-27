import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX, SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import TitleCard from '../../components/TitleCard'
import { searchTitles } from '../../services/content'
import type { Title } from '../../services/content'
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
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, genreId])

  const heading = query
    ? `${t('search.resultsFor')} «${query}»`
    : genreId
      ? `${t('search.resultsFor')} «${genreLabel || genreId}»`
      : t('search.title')

  return (
    <MainLayout>
      <h1 className={styles.heading}>{heading}</h1>

      {!hasFilter && (
        <div className={styles.state}>
          <SearchIcon size={40} />
          <p>{t('search.prompt')}</p>
        </div>
      )}

      {hasFilter && loading && <p className={styles.loading}>{t('common.loading')}</p>}

      {hasFilter && !loading && results.length === 0 && (
        <div className={styles.state}>
          <SearchX size={40} />
          <p>{t('search.noResults', { query: query || genreLabel || genreId })}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className={styles.grid}>
          {results.map((title) => (
            <TitleCard key={title.id} title={title} />
          ))}
        </div>
      )}
    </MainLayout>
  )
}
