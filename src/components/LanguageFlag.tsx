import { flagSrcFor } from '../constants/languages'
import styles from './LanguageFlag.module.css'

interface Props {
  code: string
  size?: number
  className?: string
}

/**
 * Флаг языка (SVG, круг). Для языка вне наших 10 — нейтральный значок с
 * кодом языка. Сам по себе декоративный (alt=""): название языка даёт
 * родительский элемент (aria-label/title), см. LanguageBadge.
 */
export default function LanguageFlag({ code, size = 18, className }: Props) {
  const src = flagSrcFor(code)
  const style = { width: size, height: size }
  if (src) return <img src={src} alt="" className={`${styles.flag} ${className ?? ''}`} style={style} draggable={false} />
  return (
    <span className={`${styles.neutral} ${className ?? ''}`} style={{ ...style, fontSize: Math.max(7, Math.round(size * 0.42)) }} aria-hidden="true">
      {code.slice(0, 2).toUpperCase()}
    </span>
  )
}
