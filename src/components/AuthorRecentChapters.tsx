import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import HorizontalScroller from './HorizontalScroller'
import CoverPlaceholder from './CoverPlaceholder'
import type { RecentChapterEntry } from '../services/originals/types'
import styles from './AuthorRecentChapters.module.css'

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

interface Props {
  chapters: RecentChapterEntry[]
}

/**
 * Горизонтальная лента последних опубликованных глав автора (по всем его
 * тайтлам разом) — на публичном профиле, см. AuthorProfile.tsx. Миниатюра
 * карточки — feedThumbnailUrl главы, если автор его задал в студии, иначе
 * первая страница главы (резолвится на бэкенде, см. routes/originals.ts) —
 * никогда не обложка тайтла. "New" — главы младше 7 дней, тот же порядок
 * величины, что и у бейджа в UpdateRow.tsx/NotificationRow.tsx.
 */
export default function AuthorRecentChapters({ chapters }: Props) {
  const { t } = useTranslation()

  if (chapters.length === 0) return null

  const now = Date.now()

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t('author.recentChaptersHeading')}</h2>
      <HorizontalScroller>
        {chapters.map((c) => (
          <Link key={c.chapterId} to={`/originals/${c.mangaId}/read/${c.chapterId}`} className={styles.card}>
            <div className={styles.thumbWrap}>
              <CoverPlaceholder
                cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                name={c.mangaTitle}
                imageUrl={c.thumbnailUrl ?? undefined}
                className={styles.thumb}
              />
              {now - new Date(c.publishedAt).getTime() < NEW_WINDOW_MS && <span className={styles.newBadge}>{t('common.new')}</span>}
            </div>
            <p className={styles.title}>{c.mangaTitle}</p>
            <span className={styles.chapterNumber}>{t('common.chapter', { number: c.number })}</span>
          </Link>
        ))}
      </HorizontalScroller>
    </section>
  )
}
