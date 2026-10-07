import { Crown, Frame, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

  return (
    <MainLayout>
      <SeoHead title={t('premium.title')} description={t('premium.pageIntro')} />

      <div className={styles.hero}>
        <Crown size={40} className={styles.heroIcon} />
        <h1 className={styles.heading}>{t('premium.title')}</h1>
        <p className={styles.intro}>{t('premium.pageIntro')}</p>
      </div>

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
