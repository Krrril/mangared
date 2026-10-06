import { Crown, Frame, Image as ImageIcon, Palette, Smile } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import SeoHead from '../../components/SeoHead'
import AvatarWithFrame from '../../components/AvatarWithFrame'
import StickerIcon from '../../components/StickerIcon'
import { PREMIUM_BUNDLE_IDS, PREMIUM_ACCENT_COLORS, PREMIUM_STICKERS, BACKGROUND_REGISTRY, BACKGROUND_GRADIENTS } from '../../constants/premium'
import styles from './Premium.module.css'

/**
 * Страница Premium — маркетинговый показ всех 10 связок (см. E7), не
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
          <Frame size={20} />
          <span>{t('premium.featureFrame')}</span>
        </div>
        <div className={styles.feature}>
          <ImageIcon size={20} />
          <span>{t('premium.featureBackground')}</span>
        </div>
        <div className={styles.feature}>
          <Palette size={20} />
          <span>{t('premium.featureAccent')}</span>
        </div>
        <div className={styles.feature}>
          <Smile size={20} />
          <span>{t('premium.featureStickers')}</span>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>{t('premium.readyBundles')}</h2>
      <div className={styles.bundleGrid}>
        {PREMIUM_BUNDLE_IDS.map((id) => {
          const gradient = BACKGROUND_GRADIENTS[id]
          const Art = BACKGROUND_REGISTRY[id]
          return (
            <div key={id} className={styles.bundleCard}>
              <div className={styles.bundlePreview}>
                <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" className={styles.bundleSvg} aria-hidden="true">
                  <defs>
                    <linearGradient id={`${gradient.id}-page`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor={gradient.stops[0]} />
                      <stop offset="1" stopColor={gradient.stops[1]} />
                    </linearGradient>
                  </defs>
                  <rect width="400" height="140" fill={`url(#${gradient.id}-page)`} />
                  {Art({ animated: true })}
                </svg>
                <AvatarWithFrame avatarUrl={null} name={t(`premium.bundles.${id}`) ?? id} size={72} frame={id} className={styles.bundleAvatar} />
              </div>
              <p className={styles.bundleName} style={{ color: PREMIUM_ACCENT_COLORS[id] }}>
                {t(`premium.bundles.${id}`)}
              </p>
              <span className={styles.soonTag}>{t('premium.comingSoon')}</span>
            </div>
          )
        })}
      </div>

      <h2 className={styles.sectionHeading}>{t('premium.stickersHeading')}</h2>
      <div className={styles.stickerGrid}>
        {PREMIUM_STICKERS.map((s) => (
          <div key={s} className={styles.stickerCard}>
            <StickerIcon type={s} size={28} />
            <span>{t(`premium.stickers.${s}`)}</span>
          </div>
        ))}
      </div>

      <p className={styles.footnote}>{t('premium.legalNote')}</p>
    </MainLayout>
  )
}
