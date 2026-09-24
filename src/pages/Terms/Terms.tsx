import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import styles from './Terms.module.css'

/*
  Пользовательское соглашение — черновик, написанный по факту того, что
  сайт реально делает технически (см. ARCHITECTURE.md), не юристом.
  Дополняет /privacy (там подробнее про персональные данные) и
  /publishing-rules (там — что можно и что нельзя публиковать); эта
  страница — про права на контент и общие условия пользования сайтом.

  Весь текст — в locales/*.json (legal.terms.*), инлайновые ссылки/жирный —
  через <Trans> с именованными тегами (rulesLink, privacyLink, strong).
*/
const LINKS = {
  rulesLink: <Link to="/publishing-rules" />,
  privacyLink: <Link to="/privacy" />,
  strong: <strong />,
}

export default function Terms() {
  const { t } = useTranslation()

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('legal.terms.title')}</h1>
        <p className={styles.updated}>{t('legal.terms.updated')}</p>

        <p className={styles.draftNotice}>{t('legal.terms.draftNotice')}</p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('legal.terms.s1Title')}</h2>
          <ul className={styles.list}>
            <li>
              <Trans i18nKey="legal.terms.s1p1" components={LINKS} />
            </li>
            <li>{t('legal.terms.s1p2')}</li>
            <li>
              <Trans i18nKey="legal.terms.s1p3" components={LINKS} />
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('legal.terms.s2Title')}</h2>
          <ul className={styles.list}>
            <li>{t('legal.terms.s2p1')}</li>
            <li>{t('legal.terms.s2p2')}</li>
            <li>{t('legal.terms.s2p3')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('legal.terms.s3Title')}</h2>
          <p className={styles.text}>
            <Trans i18nKey="legal.terms.s3text" components={LINKS} />
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('legal.terms.s4Title')}</h2>
          <ul className={styles.list}>
            <li>{t('legal.terms.s4p1')}</li>
            <li>
              <Trans i18nKey="legal.terms.s4p2" components={LINKS} />
            </li>
            <li>{t('legal.terms.s4p3')}</li>
            <li>
              <Trans i18nKey="legal.terms.s4p4" components={LINKS} />
            </li>
            <li>{t('legal.terms.s4p5')}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <p className={styles.text}>{t('legal.terms.contactNote')}</p>
        </section>
      </div>
    </MainLayout>
  )
}
