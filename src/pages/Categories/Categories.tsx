import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import CategoryChip from '../../components/CategoryChip'
import { getAllCategories } from '../../services/content'
import type { Category } from '../../services/content'
import styles from './Categories.module.css'

export default function Categories() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    getAllCategories().then(setCategories)
  }, [])

  return (
    <MainLayout>
      <h1 className={styles.heading}>{t('sections.categories')}</h1>
      <div className={styles.grid}>
        {categories.map((c) => (
          <CategoryChip key={c.id} id={c.id} label={c.name} />
        ))}
      </div>
    </MainLayout>
  )
}
