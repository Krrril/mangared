import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Title } from '../services/content/types'
import styles from './HeroBanner.module.css'

const AUTOPLAY_MS = 6000

export default function HeroBanner({ titles }: { titles: Title[] }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())

  // Автопрокрутка карусели — останавливается, пока курсор над баннером,
  // чтобы не перелистывать слайд прямо во время чтения описания.
  useEffect(() => {
    if (titles.length <= 1 || paused) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % titles.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [titles.length, paused])

  // Если список тайтлов обновился (например, перезагрузили страницу с
  // другим набором популярных) — не остаться на несуществующем индексе.
  useEffect(() => {
    if (index >= titles.length) setIndex(0)
  }, [titles.length, index])

  const title = titles[index]
  if (!title) return null

  const showImage = Boolean(title.coverUrlLarge) && !failedIds.has(title.id)

  return (
    <section
      className={styles.hero}
      style={{ background: `linear-gradient(115deg, ${title.cover.from}55, ${title.cover.to} 70%)` }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {showImage && (
        <img
          key={title.id}
          src={title.coverUrlLarge}
          alt=""
          className={styles.bannerImage}
          referrerPolicy="no-referrer"
          onError={() => setFailedIds((prev) => new Set(prev).add(title.id))}
        />
      )}
      <div className={styles.overlay} />
      <div className={styles.content}>
        <span className={styles.badge}>Популярное</span>
        <h1 className={styles.title}>{title.name}</h1>
        <p className={styles.meta}>
          {title.author}
          {title.artist && ` · ${title.artist}`}
        </p>
        <div className={styles.tags}>
          <span className={styles.rating}>
            <Star size={14} fill="currentColor" />
            {title.rating.toFixed(1)}
          </span>
          <span className={styles.genre}>{title.genres[0]}</span>
        </div>
        <p className={styles.description}>{title.description}</p>
        <div className={styles.actions}>
          <Link to={`/title/${title.id}`} className={styles.readButton}>
            {t('common.read')}
          </Link>
          <button type="button" className={styles.addButton} aria-label="add to list">
            <Plus size={20} />
          </button>
        </div>
      </div>
      {titles.length > 1 && (
        <div className={styles.dots}>
          {titles.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              aria-label={`${i + 1}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
