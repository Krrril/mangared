import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePublishCta } from '../hooks/usePublishCta'
import { useIsMobile } from '../hooks/useIsMobile'
import styles from './PublishHero.module.css'

interface FeaturedTitle {
  id: string
  title: string
  author: string
  cover: string
}

// 5 реально опубликованных тайтлов (см. задачу про замену стоковых панелей)
// — обложки скачаны из R2 и пережаты локально в WebP (см. предыдущую задачу,
// scripts/optimize-hero-covers.mjs уже удалён после использования), не
// отдаются напрямую с R2: один из оригиналов весил 3.2MB. author — только
// для мобильного слайдера (см. ниже, "Название тайтла и автор"), десктопная
// раскладка панелей его не показывает.
const FEATURED_TITLES: FeaturedTitle[] = [
  { id: '26cca8c5-f876-4acc-8e0c-2de6b3d6d33e', title: 'Джанет', author: 'Скарлет Пепси', cover: '/hero-authors/janet.webp' },
  { id: '1b1421bd-c7a1-4846-94af-a5cef4644732', title: 'My prey', author: 'Сабина Ходжиева', cover: '/hero-authors/my-prey.webp' },
  { id: '32a1ee51-407e-4f19-8822-ec284b4875b0', title: 'Плоть и пепел', author: 'Bymbymi4', cover: '/hero-authors/flesh-and-ash.webp' },
  {
    id: '65a7c098-f8db-4f8f-9b88-dd68635f10f6',
    title: 'Круг пороков: забытые слова',
    author: 'Maria Avis',
    cover: '/hero-authors/circle-of-vices.webp',
  },
  {
    id: 'b92c8643-976f-47a2-8687-d82197e00b0a',
    title: 'Petra: Son Of The Lightning Reaper',
    author: 'Petra Sheely - fosdick',
    cover: '/hero-authors/petra.webp',
  },
]

const AUTOPLAY_MS = 2800
// "Несколько секунд бездействия" (см. задачу) — тот же порядок величины,
// что и у паузы свайпа в RandomFeed.tsx (там 2000ms), чуть больше, потому
// что тут пауза от touch на самом слайдере, не от разового свайпа карточки.
const TOUCH_RESUME_DELAY_MS = 3500

/**
 * Промо-блок "для авторов" на главной — призыв опубликовать свою мангу/
 * манхву. Гостя при клике "Опубликовать работу" отправляем на /auth с
 * notice в location.state (см. Auth.tsx) и with from: '/creator/new',
 * чтобы после входа сразу попасть в студию, а не обратно на главную —
 * тот же паттерн redirect, что уже используют защищённые действия сайта.
 *
 * Две раскладки панелей рендерятся ОБЕ в разметке одновременно, переключение
 * между ними — чисто CSS через @media (min-width: 768px) в
 * PublishHero.module.css (см. задачу — именно по ширине экрана, а не по
 * hover-возможности, как было раньше, чтобы десктопная раскладка с
 * несколькими панелями всегда оставалась десктопной раскладкой независимо
 * от типа указателя):
 * - .panels — прежняя раскладка из 5 панелей с раздвижением при наведении
 *   (десктоп, ≥768px) — не менялась вообще, просто теперь видна по ширине.
 * - .slider — новый автопрокручивающийся слайдер на один тайтл (мобильный,
 *   <768px), см. ниже.
 * Автопрокрутка слайдера (setInterval) запускается только когда isMobile
 * (см. useIsMobile) — незачем гонять таймер в фоне на десктопной ширине,
 * где слайдер всё равно скрыт через display:none.
 */
export default function PublishHero() {
  const { t } = useTranslation()
  const goToPublish = usePublishCta()
  const isMobile = useIsMobile()

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const resumeTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!isMobile || paused) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % FEATURED_TITLES.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [isMobile, paused])

  useEffect(() => {
    return () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current)
    }
  }, [])

  function handleTouchStart() {
    if (resumeTimer.current) {
      window.clearTimeout(resumeTimer.current)
      resumeTimer.current = null
    }
    setPaused(true)
  }

  function handleTouchEnd() {
    resumeTimer.current = window.setTimeout(() => setPaused(false), TOUCH_RESUME_DELAY_MS)
  }

  const current = FEATURED_TITLES[index]

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

      <Link
        to={`/originals/${current.id}`}
        className={styles.slider}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {FEATURED_TITLES.map((title, i) => (
          <div
            key={title.id}
            className={styles.slide}
            style={{ backgroundImage: `url(${title.cover})`, opacity: i === index ? 1 : 0 }}
          />
        ))}
        <span className={styles.sliderBadge}>{t('publish.badge')}</span>
        <div className={styles.sliderInfo}>
          <p className={styles.sliderTitle}>{current.title}</p>
          <p className={styles.sliderAuthor}>{current.author}</p>
        </div>
      </Link>
      <div className={styles.sliderDots}>
        {FEATURED_TITLES.map((title, i) => (
          <button
            key={title.id}
            type="button"
            className={`${styles.sliderDot} ${i === index ? styles.sliderDotActive : ''}`}
            aria-label={`${i + 1}`}
            onClick={() => setIndex(i)}
          />
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
