import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import TitleCard from '../../components/TitleCard'
import { getTitlesByIds } from '../../services/content'
import type { Title } from '../../services/content'
import { getFavoriteIds } from '../../services/favorites'
import styles from './Favorites.module.css'

export default function Favorites() {
  const { t } = useTranslation()
  const [titles, setTitles] = useState<Title[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTitlesByIds(getFavoriteIds()).then((res) => {
      setTitles(res)
      setLoading(false)
    })
  }, [])

  return (
    <MainLayout>
      <h1 className={styles.heading}>{t('nav.favorites')}</h1>

      {loading && <p className={styles.loading}>{t('common.loading')}</p>}

      {!loading && titles.length === 0 && (
        <div className={styles.state}>
          <Heart size={40} />
          <p>{t('favorites.empty')}</p>
          <Link to="/" className={styles.homeLink}>
            {t('library.browse')}
          </Link>
        </div>
      )}

      {titles.length > 0 && (
        <div className={styles.grid}>
          {titles.map((title) => (
            <TitleCard key={title.id} title={title} />
          ))}
        </div>
      )}
    </MainLayout>
  )
}
