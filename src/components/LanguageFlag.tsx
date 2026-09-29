import { flagSrcFor } from '../constants/languages'
import styles from './LanguageFlag.module.css'

interface Props {
  code: string
  size?: number
  className?: string
}

/**
 * Флаг языка (SVG, круг). Для языка без флага в реестре (см. constants/
 * languages.ts) — нейтральный значок с кодом языка. Сам по себе декоративный
 * (alt=""): название языка даёт родительский элемент (aria-label/title).
 */
export default function LanguageFlag({ code, size = 18, className }: Props) {
  const src = flagSrcFor(code)
  const style = { width: size, height: size }
  if (src) return <img src={src} alt="" className={`${styles.flag} ${className ?? ''}`} style={style} draggable={false} loading="lazy" />
  const label = code.toUpperCase()
  // Составные коды (ja-ro) — "капсулой" по ширине текста, простые — кругом.
  const compound = label.length > 2
  return (
    <span
      className={`${styles.neutral} ${compound ? styles.neutralWide : ''} ${className ?? ''}`}
      style={{ height: size, minWidth: size, fontSize: Math.max(7, Math.round(size * (compound ? 0.34 : 0.42))) }}
      aria-hidden="true"
    >
      {label.slice(0, 5)}
    </span>
  )
}
