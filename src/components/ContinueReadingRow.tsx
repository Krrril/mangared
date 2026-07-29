import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Title, ReadingProgress } from '../services/content/types'
import CoverPlaceholder from './CoverPlaceholder'
import styles from './ContinueReadingRow.module.css'

interface Props {
  title: Title
  progress: ReadingProgress
  /** compact — узкая строка для правой панели, иначе — карточка для главной */
  compact?: boolean
}

export default function ContinueReadingRow({ title, progress, compact }: Props) {
  const { t } = useTranslation()

  return (
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
          {!compact && <MoreHorizontal size={16} className={styles.menu} />}
        </div>
        <p className={styles.chapter}>
          {t('common.chapter', { number: progress.chapterNumber })}
          <span className={styles.pageDot}>·</span>
          {t('common.page', { number: progress.pageNumber + 1 })}
        </p>
      </div>
    </Link>
  )
}
