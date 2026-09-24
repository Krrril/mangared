import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import styles from './PublishingRules.module.css'

/*
  Правила публикации авторского контента ("Originals") — ссылка на эту
  страницу стоит в чекбоксе согласия на /creator/new (см. NewManga.tsx,
  agreeLink). Раньше здесь была ComingSoon-заглушка. Текст — в
  locales/*.json (legal.rules.*).
*/
const SECTIONS: { title: string; items: string[] }[] = [
  { title: 's1Title', items: ['s1p1', 's1p2', 's1p3', 's1p4'] },
  { title: 's2Title', items: ['s2p1', 's2p2'] },
  { title: 's3Title', items: ['s3p1', 's3p2', 's3p3'] },
  { title: 's4Title', items: ['s4p1', 's4p2', 's4p3'] },
  { title: 's5Title', items: ['s5p1', 's5p2'] },
]

export default function PublishingRules() {
  const { t } = useTranslation()

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('legal.rules.title')}</h1>
        <p className={styles.updated}>{t('legal.rules.updated')}</p>

        {SECTIONS.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t(`legal.rules.${section.title}`)}</h2>
            <ul className={styles.list}>
              {section.items.map((item) => (
                <li key={item}>{t(`legal.rules.${item}`)}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className={styles.section}>
          <p className={styles.text}>{t('legal.rules.contactNote')}</p>
        </section>
      </div>
    </MainLayout>
  )
}
