import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import OriginalCard from '../../components/OriginalCard'
import { getPublicMangas } from '../../services/originals/api'
import type { OriginalsSort, PublicManga } from '../../services/originals/types'
import styles from './Originals.module.css'

export default function OriginalsCatalog() {
  const { t } = useTranslation()
  const [sort, setSort] = useState<OriginalsSort>('new')
  const [mangas, setMangas] = useState<PublicManga[] | null>(null)

  useEffect(() => {
    setMangas(null)
    getPublicMangas(sort).then(setMangas)
  }, [sort])

  return (
    <MainLayout>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>{t('originals.catalogTitle')}</h1>
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => setSort((s) => (s === 'new' ? 'popular' : 'new'))}
        >
          <ArrowUpDown size={14} />
          {sort === 'new' ? t('originals.sortNew') : t('originals.sortPopular')}
        </button>
      </div>

      {!mangas && <p className={styles.hint}>{t('common.loading')}</p>}

      {mangas && mangas.length === 0 && <p className={styles.hint}>{t('originals.empty')}</p>}

      {mangas && mangas.length > 0 && (
        <div className={styles.grid}>
          {mangas.map((m) => (
            <OriginalCard key={m.id} manga={m} />
          ))}
        </div>
      )}
    </MainLayout>
  )
}
