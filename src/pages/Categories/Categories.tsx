import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import CategoryCard from '../../components/CategoryCard'
import { getCategoryImages } from '../../services/originals/api'
import type { CategoryImage } from '../../services/originals/api'
import { CURATED_GENRES } from '../../constants/genres'
import styles from './Categories.module.css'

export default function Categories() {
  const { t } = useTranslation()
  const [images, setImages] = useState<CategoryImage[]>([])

  useEffect(() => {
    getCategoryImages().then(setImages)
  }, [])

  return (
    <MainLayout>
      <h1 className={styles.heading}>{t('sections.categories')}</h1>
      <div className={styles.grid}>
        {CURATED_GENRES.map((genre) => (
          <CategoryCard
            key={genre.id}
            genreId={genre.id}
            mangadexTagId={genre.mangadexTagId}
            label={t(`genres.${genre.id}`)}
            imageUrl={images.find((i) => i.genreId === genre.id)?.imageUrl}
          />
        ))}
      </div>
    </MainLayout>
  )
}
