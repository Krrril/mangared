import { Crown, Ban, BookOpenCheck, Heart, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import styles from './Premium.module.css'

/*
  Черновик UI под премиум-подписку — по образцу промо-блока "MangaVerse
  Premium" с исходного макета (см. DESIGN_SYSTEM.md, "Промо-карточка
  Premium"). Только интерфейс, без реальной оплаты — кнопка "Subscribe"
  ничего не отправляет на backend, monetизация ещё не спроектирована
  (см. ROADMAP.md, v3). Ветка feature/premium-subscription, в main не
  вливать до отдельного решения о монетизации.
*/

const BENEFIT_ICONS = [Ban, BookOpenCheck, Sparkles, Heart]

export default function Premium() {
  const { t } = useTranslation()
  const benefitKeys = ['noAds', 'earlyAccess', 'exclusiveContent', 'supportProject'] as const

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <Crown size={40} className={styles.crown} />
          <h1 className={styles.heroTitle}>{t('premiumPage.heroTitle')}</h1>
          <p className={styles.heroSubtitle}>{t('premiumPage.heroSubtitle')}</p>
        </section>

        <div className={styles.benefits}>
          {benefitKeys.map((key, i) => {
            const Icon = BENEFIT_ICONS[i]
            return (
              <div className={styles.benefit} key={key}>
                <div className={styles.benefitIcon}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className={styles.benefitTitle}>{t(`premiumPage.benefits.${key}.title`)}</p>
                  <p className={styles.benefitText}>{t(`premiumPage.benefits.${key}.text`)}</p>
                </div>
              </div>
            )
          })}
        </div>

        <section className={styles.plan}>
          <span className={styles.planLabel}>{t('premiumPage.planLabel')}</span>
          <p className={styles.planPrice}>
            $4.99 <span>/ {t('premiumPage.month')}</span>
          </p>
          <p className={styles.planNote}>{t('premiumPage.planNote')}</p>
          <button
            type="button"
            className={styles.subscribeButton}
            onClick={() => window.alert(t('premiumPage.stubAlert'))}
          >
            {t('premiumPage.subscribe')}
          </button>
          <p className={styles.stubHint}>{t('premiumPage.stubHint')}</p>
        </section>
      </div>
    </MainLayout>
  )
}
