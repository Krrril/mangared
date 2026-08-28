import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import SeoHead from '../../components/SeoHead'
import { usePublishCta } from '../../hooks/usePublishCta'
import styles from './BecomeAuthor.module.css'

export default function BecomeAuthor() {
  const { t } = useTranslation()
  const goToPublish = usePublishCta()

  return (
    <MainLayout>
      <SeoHead title={t('becomeAuthor.seo.title')} description={t('becomeAuthor.seo.description')} />
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('becomeAuthor.heading')}</h1>
        <p className={styles.intro}>{t('becomeAuthor.intro')}</p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('becomeAuthor.whoHeading')}</h2>
          <ul className={styles.list}>
            <li>{t('becomeAuthor.who1')}</li>
            <li>{t('becomeAuthor.who2')}</li>
            <li>{t('becomeAuthor.who3')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('becomeAuthor.whatYouGetHeading')}</h2>
          <ul className={styles.list}>
            <li>{t('becomeAuthor.get1')}</li>
            <li>
              {t('becomeAuthor.get2')} (<Link to="/terms">{t('common.terms')}</Link>)
            </li>
            <li>{t('becomeAuthor.get3')}</li>
            <li>{t('becomeAuthor.get4')}</li>
          </ul>
        </section>

        <p className={styles.communityNote}>{t('becomeAuthor.communityNote')}</p>

        <div className={styles.ctaBlock}>
          <p className={styles.ctaHeading}>{t('becomeAuthor.ctaHeading')}</p>
          <button type="button" className={styles.ctaButton} onClick={goToPublish}>
            {t('becomeAuthor.ctaButton')}
          </button>
          <p className={styles.ctaSecondary}>
            <Link to="/publish-guide">{t('becomeAuthor.ctaSecondary')}</Link>
          </p>
        </div>
      </div>
    </MainLayout>
  )
}
