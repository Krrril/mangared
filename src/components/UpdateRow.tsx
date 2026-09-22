import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { UpdateFeedEntry } from '../services/content'
import CoverPlaceholder from './CoverPlaceholder'
import styles from './UpdateRow.module.css'

export default function UpdateRow({ entry }: { entry: UpdateFeedEntry }) {
  const { t } = useTranslation()

  return (
    <Link to={`/title/${entry.title.id}/read/${entry.chapterId}`} className={styles.row}>
      <CoverPlaceholder
        cover={entry.title.cover}
        name={entry.title.name}
        imageUrl={entry.title.coverUrl}
        style={{ width: 40, height: 40, aspectRatio: 'auto', flexShrink: 0 }}
      />
      <div className={styles.info}>
        <p className={styles.name}>
          {entry.title.name}
          <span className={styles.newTag}>{t('common.new')}</span>
        </p>
        <p className={styles.chapter}>{t('common.chapter', { number: entry.chapterNumber })}</p>
      </div>
      <span className={styles.time}>{t('common.minutesAgo', { count: entry.minutesAgo })}</span>
    </Link>
  )
}
