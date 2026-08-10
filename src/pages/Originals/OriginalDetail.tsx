import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import { getPublicManga } from '../../services/originals/api'
import type { PublicMangaDetail } from '../../services/originals/types'
import styles from './Originals.module.css'

export default function OriginalDetail() {
  const { t } = useTranslation()
  const { mangaId } = useParams<{ mangaId: string }>()
  const [manga, setManga] = useState<PublicMangaDetail | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!mangaId) return
    getPublicManga(mangaId)
      .then(setManga)
      .catch(() => setNotFound(true))
  }, [mangaId])

  if (notFound) {
    return (
      <MainLayout>
        <p className={styles.hint}>{t('originals.notFound')}</p>
      </MainLayout>
    )
  }

  if (!manga) {
    return (
      <MainLayout>
        <p className={styles.hint}>{t('common.loading')}</p>
      </MainLayout>
    )
  }

  const firstChapter = manga.chapters[0]

  return (
    <MainLayout>
      <div className={styles.detailHeader}>
        <CoverPlaceholder
          cover={{ from: '#2a2a3a', to: '#1a1a24' }}
          name={manga.title}
          imageUrl={manga.coverUrl ?? undefined}
          className={styles.detailCover}
        />
        <div className={styles.detailInfo}>
          <span className={styles.originalBadge}>{t('originals.badge')}</span>
          <h1 className={styles.name}>{manga.title}</h1>
          <Link to={`/author/${manga.author.username}`} className={styles.authorLink}>
            {manga.author.displayName}
          </Link>
          <div className={styles.tags}>
            <span className={styles.pill}>{t(`creator.contentType.${manga.contentType}`)}</span>
            {manga.genres.map((g) => (
              <span key={g} className={styles.pill}>
                {g}
              </span>
            ))}
          </div>
          <p className={styles.description}>{manga.description}</p>
          {firstChapter && (
            <Link to={`/originals/${manga.id}/read/${firstChapter.id}`} className={styles.readButton}>
              {t('common.read')}
            </Link>
          )}
        </div>
      </div>

      <h2 className={styles.sectionHeading}>{t('creator.detail.chapters', { count: manga.chapters.length })}</h2>

      <div className={styles.chapterList}>
        {manga.chapters.map((c) => (
          <Link key={c.id} to={`/originals/${manga.id}/read/${c.id}`} className={styles.chapterRow}>
            <span>{t('common.chapter', { number: c.number })}</span>
            {c.title && <span className={styles.chapterTitleText}>{c.title}</span>}
            <span className={styles.chapterDate}>{new Date(c.publishedAt).toLocaleDateString()}</span>
          </Link>
        ))}
      </div>
    </MainLayout>
  )
}
