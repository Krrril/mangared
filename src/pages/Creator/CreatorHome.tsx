import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Eye, Heart } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import RequireAuth from '../../components/RequireAuth'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import { useAuth } from '../../services/auth/AuthContext'
import { getMyMangas } from '../../services/originals/api'
import type { MyManga } from '../../services/originals/types'
import { formatCount } from '../../utils/formatCount'
import styles from './Creator.module.css'

function statusClassName(status: MyManga['status']) {
  switch (status) {
    case 'published':
      return styles.statusPublished
    case 'pending':
      return styles.statusPending
    case 'rejected':
      return styles.statusRejected
    default:
      return styles.statusDraft
  }
}

function CreatorHomeContent() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [mangas, setMangas] = useState<MyManga[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    getMyMangas(token)
      .then(setMangas)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [token])

  return (
    <MainLayout>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>{t('creator.home.title')}</h1>
        <Link to="/creator/new" className={styles.primaryButtonSmall}>
          <Plus size={16} />
          {t('creator.home.newWork')}
        </Link>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {!error && !mangas && <p className={styles.hint}>{t('common.loading')}</p>}

      {!error && mangas && mangas.length === 0 && <p className={styles.hint}>{t('creator.home.empty')}</p>}

      {mangas && mangas.length > 0 && (
        <div className={styles.mangaGrid}>
          {mangas.map((m) => (
            <Link key={m.id} to={`/creator/${m.id}`} className={styles.mangaCard}>
              <CoverPlaceholder
                cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                name={m.title}
                imageUrl={m.coverUrl ?? undefined}
                className={styles.mangaCover}
              />
              <p className={styles.mangaCardTitle}>{m.title}</p>
              <span className={`${styles.statusBadge} ${statusClassName(m.status)}`}>{t(`creator.status.${m.status}`)}</span>
              <span className={styles.mangaCardMeta}>{t('creator.home.chaptersCount', { count: m.chaptersCount })}</span>
              <span className={styles.mangaCardStats}>
                <span title={t('stats.views') ?? ''}>
                  <Eye size={12} /> {formatCount(m.viewsCount)}
                </span>
                <span title={t('stats.favorites') ?? ''}>
                  <Heart size={12} /> {formatCount(m.favoritesCount)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </MainLayout>
  )
}

export default function CreatorHome() {
  return (
    <RequireAuth>
      <CreatorHomeContent />
    </RequireAuth>
  )
}
