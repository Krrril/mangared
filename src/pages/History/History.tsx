import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import ContinueReadingRow from '../../components/ContinueReadingRow'
import { getContinueReading } from '../../services/content'
import type { ContinueReadingEntry } from '../../services/content'
import styles from './History.module.css'

export default function History() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<ContinueReadingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getContinueReading().then((res) => {
      setEntries(res)
      setLoading(false)
    })
  }, [])

  return (
    <MainLayout>
      <h1 className={styles.heading}>{t('nav.history')}</h1>

      {loading && <p className={styles.loading}>{t('common.loading')}</p>}

      {!loading && entries.length === 0 && (
        <div className={styles.state}>
          <Clock size={40} />
          <p>{t('history.empty')}</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className={styles.grid}>
          {entries.map((entry) => (
            <ContinueReadingRow key={entry.title.id} title={entry.title} progress={entry.progress} />
          ))}
        </div>
      )}
    </MainLayout>
  )
}
