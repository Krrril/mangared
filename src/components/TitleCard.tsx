import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Title } from '../services/content/types'
import CoverPlaceholder from './CoverPlaceholder'
import RatingBadge from './RatingBadge'
import styles from './TitleCard.module.css'

interface Props {
  title: Title
  /** Что показать под названием — по умолчанию номер последней главы */
  subtitle?: string
}

export default function TitleCard({ title, subtitle }: Props) {
  const { t } = useTranslation()

  return (
    <Link to={`/title/${title.id}`} className={styles.card}>
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
    </Link>
  )
}
