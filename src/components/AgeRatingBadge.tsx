import { useTranslation } from 'react-i18next'
import type { AgeRating } from '../constants/ageRating'
import styles from './AgeRatingBadge.module.css'

/** Компактный бейдж возрастного рейтинга — карточки, страница тайтла, профиль автора, модерация (см. задачу про фидбек от Siva). */
export default function AgeRatingBadge({ rating, className }: { rating: AgeRating; className?: string }) {
  const { t } = useTranslation()
  const isUnrated = rating === 'unrated'
  return (
    <span
      className={[styles.badge, isUnrated ? styles.unrated : '', className].filter(Boolean).join(' ')}
      title={isUnrated ? (t('ageRating.unratedHint') ?? '') : undefined}
    >
      {t(`ageRating.${rating}`)}
    </span>
  )
}
