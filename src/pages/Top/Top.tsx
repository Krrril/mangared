import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import TitleCard from '../../components/TitleCard'
import { getTopManga } from '../../services/content'
import type { Title } from '../../services/content'
import styles from './Top.module.css'

export default function Top() {
  const { t } = useTranslation()
  const [titles, setTitles] = useState<Title[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTopManga().then((res) => {
      setTitles(res)
      setLoading(false)
    })
  }, [])

  return (
    <MainLayout>
      <h1 className={styles.heading}>{t('nav.top')}</h1>
      {loading ? (
        <p className={styles.loading}>{t('common.loading')}</p>
      ) : (
        <div className={styles.grid}>
          {titles.map((title, i) => (
            <div key={title.id} className={styles.rankedCard}>
              <span className={styles.rank}>{i + 1}</span>
              <TitleCard title={title} />
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  )
}
