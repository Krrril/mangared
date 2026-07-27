import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getContinueReading, getUpdatesFeed } from '../services/content'
import type { ContinueReadingEntry, UpdateFeedEntry } from '../services/content'
import ContinueReadingRow from '../components/ContinueReadingRow'
import UpdateRow from '../components/UpdateRow'
import styles from './RightPanel.module.css'

export default function RightPanel() {
  const { t } = useTranslation()
  const [continueReading, setContinueReading] = useState<ContinueReadingEntry[]>([])
  const [updates, setUpdates] = useState<UpdateFeedEntry[]>([])

  useEffect(() => {
    getContinueReading().then(setContinueReading)
    getUpdatesFeed().then(setUpdates)
  }, [])

  return (
    <aside className={styles.panel}>
      {continueReading.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{t('sections.continueReading')}</h3>
          <div className={styles.list}>
            {continueReading.map((entry) => (
              <ContinueReadingRow key={entry.title.id} title={entry.title} progress={entry.progress} compact />
            ))}
          </div>
          <Link to="/history" className={styles.historyButton}>
            <Clock size={16} />
            {t('common.openFullHistory')}
          </Link>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.heading}>{t('sections.recentUpdates')}</h3>
          <Link to="/updates" className={styles.seeAll}>
            {t('sections.seeAll')}
          </Link>
        </div>
        <div className={styles.list}>
          {updates.map((entry) => (
            <UpdateRow key={entry.chapterId} entry={entry} />
          ))}
        </div>
      </section>

      <section className={styles.promo}>
        <p className={styles.promoTitle}>Синхронизация на всех устройствах</p>
        <p className={styles.promoDescription}>
          Продолжай чтение с того же места на телефоне, планшете или ноутбуке.
        </p>
        <button type="button" className={styles.promoCta}>
          Подробнее
        </button>
      </section>
    </aside>
  )
}
