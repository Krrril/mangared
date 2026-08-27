import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Title, ReadingProgress } from '../services/content/types'
import CoverPlaceholder from './CoverPlaceholder'
import styles from './ContinueReadingRow.module.css'

interface Props {
  title: Title
  progress: ReadingProgress
  /** compact — узкая строка для правой панели, иначе — карточка для главной */
  compact?: boolean
  /** Если передан — рядом с "..." появляется пункт "Удалить из истории" (см. History.tsx) */
  onRemove?: (titleId: string) => void
}

export default function ContinueReadingRow({ title, progress, compact, onRemove }: Props) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={styles.wrap}>
      <Link
        to={`/title/${title.id}/read/${progress.chapterId}`}
        className={`${styles.row} ${compact ? styles.compact : ''}`}
      >
        <CoverPlaceholder
          cover={title.cover}
          name={title.name}
          imageUrl={title.coverUrl}
          style={{ width: compact ? 40 : 48, height: compact ? 40 : 48, aspectRatio: 'auto', flexShrink: 0 }}
        />
        <div className={styles.info}>
          <div className={styles.topLine}>
            <p className={styles.name}>{title.name}</p>
            {!compact && onRemove && (
              <button
                type="button"
                className={styles.menuTrigger}
                aria-label="menu"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenuOpen((v) => !v)
                }}
              >
                <MoreHorizontal size={16} />
              </button>
            )}
            {!compact && !onRemove && <MoreHorizontal size={16} className={styles.menu} />}
          </div>
          <p className={styles.chapter}>
            {t('common.chapter', { number: progress.chapterNumber })}
            <span className={styles.pageDot}>·</span>
            {t('common.page', { number: progress.pageNumber + 1 })}
          </p>
        </div>
      </Link>

      {menuOpen && onRemove && (
        <div className={styles.dropdown}>
          <button
            type="button"
            className={styles.dropdownItem}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenuOpen(false)
              onRemove(title.id)
            }}
          >
            <X size={14} />
            {t('history.removeItem')}
          </button>
        </div>
      )}
    </div>
  )
}
