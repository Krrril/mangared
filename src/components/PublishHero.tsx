import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePublishCta } from '../hooks/usePublishCta'
import styles from './PublishHero.module.css'

interface FeaturedTitle {
  id: string
  title: string
  cover: string
}

// 5 реально опубликованных тайтлов (см. задачу) вместо прежних стоковых
// панелей-заглушек — обложки скачаны из R2 и пережаты локально в WebP
// (см. scripts/optimize-hero-covers.mjs), не отдаются напрямую с R2:
// один из оригиналов весил 3.2MB, свёл бы на нет прошлую оптимизацию LCP
// на мобильных (см. commit "Cut mobile LCP/network weight"). Обратная
// сторона — обложка тут не обновится сама, если автор сменит её через
// модерацию (см. CoverChangeRequest); риск скорее теоретический для
// витрины из 5 конкретных тайтлов, при необходимости скрипт просто
// перезапускается.
const FEATURED_TITLES: FeaturedTitle[] = [
  { id: '26cca8c5-f876-4acc-8e0c-2de6b3d6d33e', title: 'Джанет', cover: '/hero-authors/janet.webp' },
  { id: '1b1421bd-c7a1-4846-94af-a5cef4644732', title: 'My prey', cover: '/hero-authors/my-prey.webp' },
  { id: '32a1ee51-407e-4f19-8822-ec284b4875b0', title: 'Плоть и пепел', cover: '/hero-authors/flesh-and-ash.webp' },
  { id: '65a7c098-f8db-4f8f-9b88-dd68635f10f6', title: 'Круг пороков: забытые слова', cover: '/hero-authors/circle-of-vices.webp' },
  { id: 'b92c8643-976f-47a2-8687-d82197e00b0a', title: 'Petra: Son Of The Lightning Reaper', cover: '/hero-authors/petra.webp' },
]

/**
 * Промо-блок "для авторов" на главной — призыв опубликовать свою мангу/
 * манхву. Гостя при клике "Опубликовать работу" отправляем на /auth с
 * notice в location.state (см. Auth.tsx) и with from: '/creator/new',
 * чтобы после входа сразу попасть в студию, а не обратно на главную —
 * тот же паттерн redirect, что уже используют защищённые действия сайта.
 *
 * Панели теперь кликабельны (ведут на страницу тайтла) с эффектом
 * "раздвижения" при наведении (десктоп) — см. .panel/.panelLabel в
 * PublishHero.module.css. Текст/кнопки поверх остаются как есть (см.
 * задачу, "оставить без изменений") — .content намеренно
 * pointer-events:none, чтобы клики по пустым местам вокруг текста
 * проходили сквозь него к панелям под ним; сами кнопки/ссылка получают
 * pointer-events:auto обратно (см. .actions).
 */
export default function PublishHero() {
  const { t } = useTranslation()
  const goToPublish = usePublishCta()

  return (
    <section className={styles.hero}>
      <div className={styles.panels}>
        {FEATURED_TITLES.map((title) => (
          <Link
            key={title.id}
            to={`/originals/${title.id}`}
            className={styles.panel}
            style={{ backgroundImage: `url(${title.cover})` }}
          >
            <span className={styles.panelLabel}>{title.title}</span>
          </Link>
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
