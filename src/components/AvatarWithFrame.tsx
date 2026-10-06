import { useEffect, useState } from 'react'
import { FRAME_REGISTRY, isPremiumBundleId } from '../constants/premium'
import { usePremiumStyles } from '../hooks/usePremiumStyles'
import styles from './AvatarWithFrame.module.css'

/** Насколько SVG-рамка больше самого аватара — части (уши, шляпа, хвост) выходят за круг именно в этот запас (см. constants/premium.tsx, viewBox 0 0 140 140). */
const FRAME_SCALE = 1.4

interface Props {
  avatarUrl: string | null
  /** Для инициала-заглушки, когда нет фото. */
  name: string
  /** Диаметр самого аватара в px — рамка занимает size*1.4 и не меняет расчёт места в layout (см. .frame, position:absolute). */
  size: number
  /** id рамки (см. FRAME_REGISTRY) или null — тогда просто обычный аватар без Premium-оформления. */
  frame?: string | null
  className?: string
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
 * Аватар + Premium-рамка вокруг него (см. E4) — единственное место, где
 * рисуется рамка, все остальные компоненты сайта (профиль, комментарии,
 * список авторов) используют только его. Сам аватар — статичная картинка/
 * инициал, как и раньше (см. задачу — "аватар остаётся обычным для всех").
 * Обёртка занимает ровно size×size в layout — рамка нарисована ПОВЕРХ
 * через position:absolute с отрицательным отступом, так что не раздувает
 * грид/флекс-контейнеры карточек. Родительские контейнеры с overflow:hidden
 * всё равно обрежут её — см. места использования (там убран/ослаблен overflow).
 */
export default function AvatarWithFrame({ avatarUrl, name, size, frame, className }: Props) {
  usePremiumStyles()
  const reducedMotion = usePrefersReducedMotion()
  const FrameArt = frame && isPremiumBundleId(frame) ? FRAME_REGISTRY[frame] : null
  const svgSize = Math.round(size * FRAME_SCALE)
  const offset = Math.round((svgSize - size) / 2)
  // На мелких размерах упрощаем — тонкие линии/мелкие лепестки превращаются в кашу
  // меньше ~28px, там показываем только сам аватар без рамки.
  const showFrame = FrameArt && size >= 28

  return (
    <span className={`${styles.wrap} ${className ?? ''}`} style={{ width: size, height: size }}>
      <span className={styles.disc} style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)) }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className={styles.img} />
        ) : (
          <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        )}
      </span>
      {showFrame && (
        <svg
          viewBox="0 0 140 140"
          width={svgSize}
          height={svgSize}
          className={styles.frame}
          style={{ left: -offset, top: -offset }}
          aria-hidden="true"
        >
          {FrameArt({ animated: !reducedMotion })}
        </svg>
      )}
    </span>
  )
}
