import { Link, useNavigate } from 'react-router-dom'
import { Eye, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PublicManga } from '../services/originals/types'
import { formatCount } from '../utils/formatCount'
import CoverPlaceholder from './CoverPlaceholder'
import AgeRatingBadge from './AgeRatingBadge'
import LanguageBadge from './LanguageBadge'
import { readingPath } from '../services/readingLanguage'
import styles from './OriginalCard.module.css'

/** Карточка авторского тайтла — используется в витрине на главной, в /originals и на профиле автора. */
export default function OriginalCard({ manga }: { manga: PublicManga }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className={styles.card}>
      <Link to={`/originals/${manga.id}`} className={styles.coverWrap}>
        <CoverPlaceholder
          cover={{ from: '#2a2a3a', to: '#1a1a24' }}
          name={manga.title}
          imageUrl={manga.coverUrl ?? undefined}
        />
        <div className={styles.topRow}>
          <span className={styles.originalBadge}>{t('originals.badge')}</span>
          <AgeRatingBadge rating={manga.ageRating} className={styles.ageBadge} />
        </div>
        <LanguageBadge
          languages={manga.languages}
          primary={manga.primaryLanguage}
          onSelect={(lang) => navigate(readingPath(`/originals/${manga.id}`, lang))}
        />
      </Link>
      <Link to={`/originals/${manga.id}`} className={styles.name}>
        {manga.title}
      </Link>
      <Link to={`/author/${manga.author.username}`} className={styles.author}>
        {manga.author.displayName}
      </Link>
      <p className={styles.subtitle}>{t('common.chapter', { number: manga.chaptersCount })}</p>
      {(manga.viewsCount > 0 || manga.favoritesCount > 0) && (
        <p className={styles.statsRow}>
          <span className={styles.statsItem} title={t('stats.views') ?? ''}>
            <Eye size={12} /> {formatCount(manga.viewsCount)}
          </span>
          <span className={styles.statsItem} title={t('stats.favorites') ?? ''}>
            <Heart size={12} /> {formatCount(manga.favoritesCount)}
          </span>
        </p>
      )}
    </div>
  )
}
