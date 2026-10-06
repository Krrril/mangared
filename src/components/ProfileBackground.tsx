import { useEffect, useRef, useState } from 'react'
import { BACKGROUND_REGISTRY, BACKGROUND_GRADIENTS, isPremiumBundleId } from '../constants/premium'
import { usePremiumStyles } from '../hooks/usePremiumStyles'
import styles from './ProfileBackground.module.css'

interface Props {
  /** id фона (см. BACKGROUND_REGISTRY) или null/не-Premium — тогда просто ничего не рендерим. */
  background: string | null
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReduced(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduced
}

/**
 * Фон профиля автора (см. E4) — рисуется за верхним блоком (аватар, имя,
 * статистика), во всю ширину, виден ВСЕМ, кто заходит в профиль (не только
 * владельцу). Полупрозрачная подложка поверх (.overlay) — чтобы текст
 * читался в обеих темах поверх любого фона. Анимация встаёт на паузу, пока
 * блок вне экрана или вкладка скрыта (см. IntersectionObserver +
 * visibilitychange ниже) — фонов может быть несколько на странице (хотя на
 * практике один), и это довольно много анимированных SVG-элементов разом.
 */
export default function ProfileBackground({ background }: Props) {
  usePremiumStyles()
  const reducedMotion = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(!document.hidden)

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { rootMargin: '200px 0px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handler = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  if (!background || !isPremiumBundleId(background)) return null
  const Art = BACKGROUND_REGISTRY[background]
  const gradient = BACKGROUND_GRADIENTS[background]
  const animated = !reducedMotion && inView && tabVisible

  return (
    <div ref={ref} className={styles.wrap} aria-hidden="true">
      <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" className={styles.svg}>
        <defs>
          <linearGradient id={gradient.id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={gradient.stops[0]} />
            <stop offset="1" stopColor={gradient.stops[1]} />
          </linearGradient>
        </defs>
        {Art({ animated })}
      </svg>
      <div className={styles.overlay} />
    </div>
  )
}
