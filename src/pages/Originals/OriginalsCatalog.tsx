import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import OriginalCard from '../../components/OriginalCard'
import { getOriginalsGenres, getPublicMangas } from '../../services/originals/api'
import type { MangaContentType, OriginalsSort, PublicManga } from '../../services/originals/types'
import styles from './Originals.module.css'

const CONTENT_TYPES: MangaContentType[] = ['manga', 'manhwa', 'comic']

export default function OriginalsCatalog() {
  const { t } = useTranslation()
  const [sort, setSort] = useState<OriginalsSort>('new')
  const [genre, setGenre] = useState<string>('')
  const [contentType, setContentType] = useState<MangaContentType | ''>('')
  const [genres, setGenres] = useState<string[]>([])
  const [mangas, setMangas] = useState<PublicManga[] | null>(null)

  useEffect(() => {
    getOriginalsGenres().then(setGenres)
  }, [])

  useEffect(() => {
    setMangas(null)
    getPublicMangas({ sort, genre: genre || undefined, contentType: contentType || undefined }).then(setMangas)
  }, [sort, genre, contentType])

  return (
    <MainLayout>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>{t('originals.catalogTitle')}</h1>
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => setSort((s) => (s === 'new' ? 'popular' : 'new'))}
        >
          <ArrowUpDown size={14} />
          {sort === 'new' ? t('originals.sortNew') : t('originals.sortPopular')}
        </button>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.segmented}>
          <button type="button" className={contentType === '' ? styles.segmentActive : styles.segment} onClick={() => setContentType('')}>
            {t('originals.filterAll')}
          </button>
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct}
              type="button"
              className={contentType === ct ? styles.segmentActive : styles.segment}
              onClick={() => setContentType(ct)}
            >
              {t(`creator.contentType.${ct}`)}
            </button>
          ))}
        </div>

        {genres.length > 0 && (
          <select className={styles.genreSelect} value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">{t('originals.filterAllGenres')}</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>

      {!mangas && <p className={styles.hint}>{t('common.loading')}</p>}

      {mangas && mangas.length === 0 && <p className={styles.hint}>{t('originals.empty')}</p>}

      {mangas && mangas.length > 0 && (
        <div className={styles.grid}>
          {mangas.map((m) => (
            <OriginalCard key={m.id} manga={m} />
          ))}
        </div>
      )}
    </MainLayout>
  )
}
