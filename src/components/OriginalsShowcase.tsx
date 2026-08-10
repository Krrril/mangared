import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getPublicMangas } from '../services/originals/api'
import type { PublicManga } from '../services/originals/types'
import OriginalCard from './OriginalCard'
import styles from './OriginalsShowcase.module.css'

const MIN_TITLES_TO_SHOW = 4

/** Витрина авторских тайтлов на главной — не рендерится вовсе, пока опубликованных работ меньше 4х (см. Шаг 7). */
export default function OriginalsShowcase() {
  const { t } = useTranslation()
  const [mangas, setMangas] = useState<PublicManga[] | null>(null)

  useEffect(() => {
    getPublicMangas('popular').then(setMangas)
  }, [])

  if (!mangas || mangas.length < MIN_TITLES_TO_SHOW) return null

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('originals.showcaseTitle')}</h2>
        <Link to="/originals" className={styles.seeAll}>
          {t('sections.seeAll')} <ChevronRight size={16} />
        </Link>
      </div>
      <div className={styles.grid}>
        {mangas.slice(0, 8).map((m) => (
          <OriginalCard key={m.id} manga={m} />
        ))}
      </div>
    </section>
  )
}
