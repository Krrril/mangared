import { useEffect, useState } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import ContinueReadingRow from '../../components/ContinueReadingRow'
import { getContinueReading } from '../../services/content'
import type { ContinueReadingEntry } from '../../services/content'
import { deleteProgress, clearAllProgress } from '../../services/progress'
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

  function handleRemoveOne(titleId: string) {
    setEntries((prev) => prev.filter((e) => e.title.id !== titleId))
    deleteProgress(titleId).catch(console.error)
  }

  function handleClearAll() {
    if (!window.confirm(t('history.clearConfirm') ?? '')) return
    setEntries([])
    clearAllProgress().catch(console.error)
  }

  return (
    <MainLayout>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>{t('nav.history')}</h1>
        {entries.length > 0 && (
          <button type="button" className={styles.clearButton} onClick={handleClearAll}>
            <Trash2 size={14} />
            {t('history.clearAll')}
          </button>
        )}
      </div>

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
            <ContinueReadingRow
              key={entry.title.id}
              title={entry.title}
              progress={entry.progress}
              onRemove={handleRemoveOne}
            />
          ))}
        </div>
      )}
    </MainLayout>
  )
}
