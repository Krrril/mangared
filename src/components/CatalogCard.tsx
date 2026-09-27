import { Link } from 'react-router-dom'
import { Heart, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Title } from '../services/content/types'
import type { PublicManga } from '../services/originals/types'
import { formatCount } from '../utils/formatCount'
import CoverPlaceholder from './CoverPlaceholder'
import styles from './CatalogCard.module.css'

export type CatalogItem = { kind: 'original'; manga: PublicManga } | { kind: 'mangadex'; title: Title }

/**
 * Карточка сетки /catalog: обложка, бейдж в углу (звезда + рейтинг из
 * MangaDex statistics для каталога; сердечко + число лайков для Originals —
 * у авторских тайтлов звёздного рейтинга нет, есть только лайки/просмотры),
 * под обложкой — тип контента и год, затем название.
 */
export default function CatalogCard({ item }: { item: CatalogItem }) {
  const { t } = useTranslation()

  if (item.kind === 'original') {
    const { manga } = item
    const year = manga.createdAt ? new Date(manga.createdAt).getFullYear() : undefined
    return (
      <Link to={`/originals/${manga.id}`} className={styles.card}>
        <div className={styles.coverWrap}>
          <CoverPlaceholder
            cover={{ from: '#2a2a3a', to: '#1a1a24' }}
            name={manga.title}
            imageUrl={manga.coverUrl ?? undefined}
          />
          {manga.favoritesCount > 0 && (
            <span className={styles.badge}>
              <Heart size={12} fill="currentColor" />
              {formatCount(manga.favoritesCount)}
            </span>
          )}
          <span className={styles.originalTag}>{t('originals.badge')}</span>
        </div>
        <p className={styles.meta}>
          {t(`creator.contentType.${manga.contentType}`)}
          {year ? ` · ${year}` : ''}
        </p>
        <p className={styles.name}>{manga.title}</p>
      </Link>
    )
  }

  const { title } = item
  return (
    <Link to={`/title/${title.id}`} className={styles.card}>
      <div className={styles.coverWrap}>
        <CoverPlaceholder cover={title.cover} name={title.name} imageUrl={title.coverUrl} />
        {title.rating > 0 && (
          <span className={`${styles.badge} ${styles.badgeStar}`}>
            <Star size={12} fill="currentColor" />
            {title.rating.toFixed(1)}
          </span>
        )}
      </div>
      <p className={styles.meta}>
        {t(`creator.contentType.${title.type}`)}
        {title.year ? ` · ${title.year}` : ''}
      </p>
      <p className={styles.name}>{title.name}</p>
    </Link>
  )
}
