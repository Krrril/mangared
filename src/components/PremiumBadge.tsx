import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './PremiumBadge.module.css'

interface Props {
  size?: number
  className?: string
}

/** Корона рядом с ником Premium-пользователя (см. E3) — в профиле, комментариях, списке авторов. Видна всем. */
export default function PremiumBadge({ size = 14, className }: Props) {
  const { t } = useTranslation()
  const label = t('premium.badge') ?? 'Premium'
  return (
    <span className={`${styles.badge} ${className ?? ''}`} title={label} role="img" aria-label={label}>
      <Crown size={size} fill="currentColor" strokeWidth={1.5} />
    </span>
  )
}
