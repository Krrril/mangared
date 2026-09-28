import type { CSSProperties } from 'react'
import type { CoverStyle } from '../services/content/types'
import ImageWithRetry from './ImageWithRetry'
import styles from './CoverPlaceholder.module.css'

interface Props {
  cover: CoverStyle
  name: string
  /** Настоящая обложка из MangaDex — если задана и загружается без ошибок, показывается вместо градиента */
  imageUrl?: string
  className?: string
  /** Переопределяет размер/aspect-ratio — например, квадратный тумбнейл в списках */
  style?: CSSProperties
}

/**
 * Обложка тайтла. Основной источник — картинка с MangaDex (imageUrl).
 * Если её нет или она не загрузилась (404, тайтл без обложки и т.п.),
 * показываем стилизованный градиент в фирменной палитре с первой буквой
 * названия — см. mappers.ts, gradientForId.
 */
export default function CoverPlaceholder({ cover, name, imageUrl, className, style }: Props) {
  // Градиент с буквой рисуется всегда: он же заглушка, пока обложка грузится
  // (а на MangaDex она грузится с повторами, см. ImageWithRetry), и итог, если
  // все попытки исчерпаны — тогда картинка просто не появляется поверх него.
  return (
    <div
      className={`${styles.cover} ${className ?? ''}`}
      style={{ background: `linear-gradient(160deg, ${cover.from}, ${cover.to})`, ...style }}
    >
      <span className={styles.glyph}>{name.charAt(0)}</span>
      {imageUrl && <ImageWithRetry variant="cover" src={imageUrl} alt={name} className={styles.image} fallback={null} />}
    </div>
  )
}
