import { useEffect, useRef, useState, Children } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './HorizontalScroller.module.css'

/**
 * Один скроллящийся ряд карточек со стрелками по бокам — та же стрелочная
 * логика/стиль, что и у карусели "Популярное" (см. HeroBanner.module.css,
 * .navButton/.navPrev/.navNext/.navHidden — стили здесь намеренно
 * продублированы 1:1, не шарятся между CSS-модулями разных компонентов).
 * В отличие от HeroBanner (постраничная пагинация состоянием), здесь
 * обычный нативный горизонтальный скролл — стрелки просто прокручивают
 * контейнер (scrollBy), а не переключают "страницы" данных. На тач-экранах
 * стрелки скрыты (см. CSS, hover:hover and pointer:fine) — там прокрутка
 * свайпом, стрелки были бы лишним элементом поверх него.
 */
export default function HorizontalScroller({ children }: { children: React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateArrows() {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    const resizeObserver = new ResizeObserver(updateArrows)
    resizeObserver.observe(el)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      resizeObserver.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Children.count(children)])

  function scrollByScreen(direction: 1 | -1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.navButton} ${styles.navPrev} ${!canScrollLeft ? styles.navHidden : ''}`}
        aria-label="Previous"
        onClick={() => scrollByScreen(-1)}
      >
        <ChevronLeft size={20} />
      </button>
      <div className={styles.scroller} ref={scrollerRef}>
        {Children.map(children, (child) => (
          <div className={styles.item}>{child}</div>
        ))}
      </div>
      <button
        type="button"
        className={`${styles.navButton} ${styles.navNext} ${!canScrollRight ? styles.navHidden : ''}`}
        aria-label="Next"
        onClick={() => scrollByScreen(1)}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
