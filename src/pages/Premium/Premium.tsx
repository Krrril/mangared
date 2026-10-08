import { useEffect, useState } from 'react'
import { Crown, Frame, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../services/auth/AuthContext'
import { getMyPremium } from '../../services/premium/api'
import type { PremiumMe } from '../../services/premium/api'
import MainLayout from '../../layouts/MainLayout'
import SeoHead from '../../components/SeoHead'
import AvatarWithFrame from '../../components/AvatarWithFrame'
import PremiumBadge from '../../components/PremiumBadge'
import { PREMIUM_FRAME_IDS, PREMIUM_ACCENT_COLORS, ACCENT_TEXT_CLASS, accentVars } from '../../constants/premium'
import styles from './Premium.module.css'

/**
 * Страница Premium — маркетинговый показ рамок/цвета/бейджа (см. E7), не
 * функциональный выбор (настройка — в профиле, см. PremiumPicker.tsx).
 * Вместо цены пометка "Скоро" (оплату не подключаем на этом этапе).
 * ЮРИДИЧЕСКОЕ ОГРАНИЧЕНИЕ: ничего про каталог MangaDex и отключение рекламы —
 * только профиль/комментарии/свой контент (см. задачу).
 */
export default function Premium() {
  const { t } = useTranslation()
  const { token, user } = useAuth()
  const [me, setMe] = useState<PremiumMe | null>(null)

  // Свой статус (до какого числа / навсегда / постоянный у админа) — только залогиненному
  // и только если Premium вообще активен; без новых полей в ответе просто ничего не покажем.
  useEffect(() => {
    if (!token) return
    getMyPremium(token).then(setMe).catch(() => setMe(null))
  }, [token])

  const permanent = !!(user?.isAdmin || me?.premiumPermanent)
  let status: string | null = null
  if (permanent) status = t('premium.statusPermanent')
  else if (me?.isPremium && me.premiumForever) status = t('premium.statusForever')
  else if (me?.isPremium && me.premiumUntil) status = t('premium.statusUntil', { date: new Date(me.premiumUntil).toLocaleDateString() })

  return (
    <MainLayout>
      <SeoHead title={t('premium.title')} description={t('premium.pageIntro')} />

      <div className={styles.hero}>
        <Crown size={40} className={styles.heroIcon} />
        <h1 className={styles.heading}>{t('premium.title')}</h1>
        <p className={styles.intro}>{t('premium.pageIntro')}</p>
      </div>

      {status && (
        <p className={styles.status} role="status">
          <Crown size={14} /> {status}
        </p>
      )}

      <div className={styles.features}>
        <div className={styles.feature}>
          <Crown size={20} />
          <span>{t('premium.featureBadge')}</span>
        </div>
        <div className={styles.feature}>
          <Frame size={20} />
          <span>{t('premium.featureFrame')}</span>
        </div>
        <div className={styles.feature}>
          <Palette size={20} />
          <span>{t('premium.featureAccent')}</span>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>{t('premium.framesHeading')}</h2>
      <div className={styles.frameGrid}>
        {PREMIUM_FRAME_IDS.map((id) => (
          <div key={id} className={styles.frameCard}>
            <AvatarWithFrame avatarUrl={null} name={t(`premium.frames.${id}`) ?? id} size={72} frame={id} />
            <p className={`${styles.frameName} ${ACCENT_TEXT_CLASS}`} style={accentVars(PREMIUM_ACCENT_COLORS[id])}>
              {t(`premium.frames.${id}`)}
              <PremiumBadge size={12} />
            </p>
          </div>
        ))}
      </div>

      <span className={styles.soonTag}>{t('premium.comingSoon')}</span>

      <p className={styles.footnote}>{t('premium.legalNote')}</p>
    </MainLayout>
  )
}
