import { useState, type CSSProperties } from 'react'
import type { CoverStyle } from '../services/content/types'
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
  const [failed, setFailed] = useState(false)
  const showImage = imageUrl && !failed

  return (
    <div
      className={`${styles.cover} ${className ?? ''}`}
      style={{
        background: showImage ? undefined : `linear-gradient(160deg, ${cover.from}, ${cover.to})`,
        ...style,
      }}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          className={styles.image}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.glyph}>{name.charAt(0)}</span>
      )}
    </div>
  )
}
