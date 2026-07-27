import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import UpdateRow from '../../components/UpdateRow'
import { getUpdatesFeed } from '../../services/content'
import type { UpdateFeedEntry } from '../../services/content'
import styles from './Updates.module.css'

export default function Updates() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<UpdateFeedEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUpdatesFeed(30).then((res) => {
      setEntries(res)
      setLoading(false)
    })
  }, [])

  return (
    <MainLayout>
      <h1 className={styles.heading}>{t('nav.updates')}</h1>
      {loading ? (
        <p className={styles.loading}>{t('common.loading')}</p>
      ) : (
        <div className={styles.list}>
          {entries.map((entry) => (
            <UpdateRow key={entry.chapterId} entry={entry} />
          ))}
        </div>
      )}
    </MainLayout>
  )
}
