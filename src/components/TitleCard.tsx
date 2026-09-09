import { Link } from 'react-router-dom'
import { Eye, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Title } from '../services/content/types'
import type { TitleStats } from '../services/stats/api'
import { formatCount } from '../utils/formatCount'
import CoverPlaceholder from './CoverPlaceholder'
import RatingBadge from './RatingBadge'
import styles from './TitleCard.module.css'

interface Props {
  title: Title
  /** Что показать под названием — по умолчанию номер последней главы */
  subtitle?: string
  /** Просмотры/лайки — если не переданы, строка счётчиков просто не показывается (см. Search.tsx) */
  stats?: TitleStats
  /**
   * 'large' — крупная карточка с эффектом приподнятия при наведении (см.
   * секцию "Недавно добавленные" на главной, задачу про её редизайн).
   * По умолчанию — обычный маленький размер, как везде на сайте
   * (Search, Top, Categories и т.д.) — не трогаем их вид этой правкой.
   */
  size?: 'default' | 'large'
}

export default function TitleCard({ title, subtitle, stats, size = 'default' }: Props) {
  const { t } = useTranslation()

  return (
    <Link to={`/title/${title.id}`} className={`${styles.card} ${size === 'large' ? styles.cardLarge : ''}`}>
      <div className={styles.coverWrap}>
        <CoverPlaceholder cover={title.cover} name={title.name} imageUrl={title.coverUrl} />
        {title.isNew ? (
          <span className={styles.newBadge}>{t('common.new')}</span>
        ) : (
          <RatingBadge rating={title.rating} />
        )}
      </div>
      <p className={styles.name}>{title.name}</p>
      <p className={styles.subtitle}>
        {subtitle ?? t('common.chapter', { number: title.chaptersCount })}
      </p>
      {stats && (stats.views > 0 || stats.favorites > 0) && (
        <p className={styles.statsRow}>
          <span className={styles.statsItem} title={t('stats.views') ?? ''}>
            <Eye size={12} /> {formatCount(stats.views)}
          </span>
          <span className={styles.statsItem} title={t('stats.favorites') ?? ''}>
            <Heart size={12} /> {formatCount(stats.favorites)}
          </span>
        </p>
      )}
    </Link>
  )
}
