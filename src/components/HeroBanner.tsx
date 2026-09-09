import { useEffect, useState } from 'react'
import TitleCard from './TitleCard'
import SkeletonCard from './SkeletonCard'
import type { Title } from '../services/content/types'
import styles from './HeroBanner.module.css'

const VISIBLE_COUNT = 4
const AUTOPLAY_MS = 6000

/**
 * Секция "Популярное" на главной — сетка из 4 крупных карточек одновременно
 * (см. задачу про редизайн), с автопрокруткой по страницам через весь
 * полученный набор тайтлов (см. Home.tsx, getFeaturedTitles(12)) — тот же
 * приём, что был у прежнего однослайдового баннера (автопрокрутка, пауза
 * при наведении, точки-навигация), просто по группам из 4, а не по одному
 * тайтлу. Плашка "Популярное" — тот же текст и внешний вид (не переводить
 * через i18n, не переименовывать).
 *
 * Скелетон рендерится ЗДЕСЬ же, в том же .grid, что и реальный контент
 * (не отдельным блоком в Home.tsx с собственной сеткой) — иначе при
 * разных grid-template-columns у скелетона и реальной сетки высота двух
 * состояний отличается, и в момент подмены получается заметный CLS
 * (было ровно так: heroSkeleton в Home.module.css использовал
 * auto-fill/minmax(240px), а эта сетка — фиксированные 4 колонки с
 * брейкпоинтом на 1279px, из-за чего на типичной десктопной ширине
 * скелетон был в 2 строки, а реальный контент — в одну).
 */
export default function HeroBanner({ titles, loading = false }: { titles: Title[]; loading?: boolean }) {
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)

  const pageCount = Math.ceil(titles.length / VISIBLE_COUNT)

  useEffect(() => {
    if (pageCount <= 1 || paused) return
    const timer = setInterval(() => {
      setPage((p) => (p + 1) % pageCount)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [pageCount, paused])

  // Если список тайтлов обновился и стал короче — не остаться на
  // несуществующей странице.
  useEffect(() => {
    if (page >= pageCount) setPage(0)
  }, [pageCount, page])

  if (!loading && titles.length === 0) return null

  const visible = titles.slice(page * VISIBLE_COUNT, page * VISIBLE_COUNT + VISIBLE_COUNT)

  return (
    <section onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span className={styles.badge}>Популярное</span>
      <div className={styles.grid}>
        {loading
          ? Array.from({ length: VISIBLE_COUNT }, (_, i) => <SkeletonCard key={i} />)
          : visible.map((title) => <TitleCard key={title.id} title={title} size="large" />)}
      </div>
      {!loading && pageCount > 1 && (
        <div className={styles.dots}>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.dot} ${i === page ? styles.dotActive : ''}`}
              aria-label={`${i + 1}`}
              onClick={() => setPage(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
