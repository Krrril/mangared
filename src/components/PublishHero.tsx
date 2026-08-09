import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePublishCta } from '../hooks/usePublishCta'
import styles from './PublishHero.module.css'

const PANELS = [
  '/hero/panel-1-blue.webp',
  '/hero/panel-2-green.webp',
  '/hero/panel-3-warm.jpg',
  '/hero/panel-4-purple.jpg',
  '/hero/panel-5-mono.webp',
  '/hero/panel-6-yellow.webp',
]

/**
 * Промо-блок "для авторов" на главной — призыв опубликовать свою мангу/
 * манхву. Гостя при клике "Опубликовать работу" отправляем на /auth с
 * notice в location.state (см. Auth.tsx) и with from: '/creator/new',
 * чтобы после входа сразу попасть в студию, а не обратно на главную —
 * тот же паттерн redirect, что уже используют защищённые действия сайта.
 */
export default function PublishHero() {
  const { t } = useTranslation()
  const goToPublish = usePublishCta()

  return (
    <section className={styles.hero}>
      <div className={styles.panels}>
        {PANELS.map((src) => (
          <div key={src} className={styles.panel} style={{ backgroundImage: `url(${src})` }} />
        ))}
      </div>
      <div className={styles.overlay} />
      <div className={styles.content}>
        <span className={styles.badge}>{t('publish.badge')}</span>
        <h1 className={styles.heading}>{t('publish.heading')}</h1>
        <p className={styles.subheading}>{t('publish.subheading')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={goToPublish}>
            {t('publish.cta')}
          </button>
          <Link to="/publishing-rules" className={styles.secondaryButton}>
            {t('publish.howItWorks')}
          </Link>
        </div>
      </div>
    </section>
  )
}
