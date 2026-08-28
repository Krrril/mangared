import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import SeoHead from '../../components/SeoHead'
import { usePublishCta } from '../../hooks/usePublishCta'
import styles from './PublishGuide.module.css'

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'] as const

export default function PublishGuide() {
  const { t } = useTranslation()
  const goToPublish = usePublishCta()

  return (
    <MainLayout>
      <SeoHead title={t('publishGuide.seo.title')} description={t('publishGuide.seo.description')} />
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('publishGuide.heading')}</h1>
        <p className={styles.intro}>{t('publishGuide.intro')}</p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('publishGuide.stepsHeading')}</h2>
          <div className={styles.steps}>
            {STEP_KEYS.map((key) => (
              <div key={key} className={styles.step}>
                <p className={styles.stepTitle}>{t(`publishGuide.${key}Title`)}</p>
                <p className={styles.stepText}>{t(`publishGuide.${key}Text`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('publishGuide.benefitsHeading')}</h2>
          <ul className={styles.benefits}>
            <li>{t('publishGuide.benefit1')}</li>
            <li>
              {t('publishGuide.benefit2')} <Link to="/terms">{t('common.terms')}</Link>
            </li>
            <li>{t('publishGuide.benefit3')}</li>
            <li>{t('publishGuide.benefit4')}</li>
          </ul>
        </section>

        <div className={styles.ctaBlock}>
          <button type="button" className={styles.ctaButton} onClick={goToPublish}>
            {t('publishGuide.ctaButton')}
          </button>
          <p className={styles.ctaSecondary}>
            <Link to="/become-author">{t('publishGuide.ctaSecondary')}</Link>
          </p>
        </div>
      </div>
    </MainLayout>
  )
}
