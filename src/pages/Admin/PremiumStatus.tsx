import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './PremiumAdmin.module.css'

export interface PremiumStatusValue {
  isPremium: boolean
  /** Админ: Premium постоянный по роли, дата не показывается. */
  premiumPermanent?: boolean
  /** Выдан "навсегда" (2099-12-31) — показываем словом, а не датой. */
  premiumForever?: boolean
  premiumUntil: string | null
}

/** Подпись статуса Premium: постоянный (админ) / навсегда / до даты / нет. Одна на таблицу пользователей и вкладку "Premium". */
export default function PremiumStatus({ u }: { u: PremiumStatusValue }) {
  const { t } = useTranslation()
  if (!u.isPremium) return <span className={styles.statusNone}>{t('admin.premiumNone')}</span>
  const label = u.premiumPermanent
    ? t('admin.premiumPermanent')
    : u.premiumForever
      ? t('admin.premiumForever')
      : t('admin.premiumUntil', { date: u.premiumUntil ? new Date(u.premiumUntil).toLocaleDateString() : '' })
  return (
    <span className={styles.statusBadge}>
      <Crown size={12} /> {label}
    </span>
  )
}
