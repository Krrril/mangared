import { Trans, useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import styles from './PrivacyPolicy.module.css'

/*
  Базовая заглушка политики конфиденциальности — нужна как минимальная
  честная страница для баннера согласия на cookies (см. CookieConsent).
  Не юридический документ, составленный юристом — это описание того, что
  сайт реально делает технически (см. ARCHITECTURE.md), в понятной форме.
  Заменить на полноценную версию, когда до этого дойдёт очередь (см. ROADMAP.md).
  Текст — в locales/*.json (legal.privacy.*).
*/
const SECTIONS = [
  { title: 'whatTitle', text: 'whatText' },
  { title: 'accountTitle', text: 'accountText' },
  { title: 'readingTitle', text: 'readingText' },
  { title: 'cookiesTitle', text: 'cookiesText' },
  { title: 'thirdTitle', text: 'thirdText' },
  { title: 'choicesTitle', text: 'choicesText' },
]

export default function PrivacyPolicy() {
  const { t } = useTranslation()

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('legal.privacy.title')}</h1>
        <p className={styles.updated}>{t('legal.privacy.updated')}</p>

        {SECTIONS.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t(`legal.privacy.${section.title}`)}</h2>
            <p className={styles.text}>
              <Trans
                i18nKey={`legal.privacy.${section.text}`}
                components={{ mdLink: <a href="https://mangadex.org" target="_blank" rel="noopener noreferrer" /> }}
              />
            </p>
          </section>
        ))}
      </div>
    </MainLayout>
  )
}
