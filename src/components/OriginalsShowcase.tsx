import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getPublicMangas } from '../services/originals/api'
import type { PublicManga } from '../services/originals/types'
import OriginalCard from './OriginalCard'
import styles from './OriginalsShowcase.module.css'

// Раньше было 4 — секция вообще не показывалась, пока не набиралось хотя бы
// столько опубликованных работ (см. Шаг 7), и первый одобренный тайтл
// внешнего автора был не виден нигде на главной. Порог 1 — секция
// появляется сразу же после первого же одобрения, что и было целью.
const MIN_TITLES_TO_SHOW = 1

/** Витрина недавно одобренных авторских тайтлов на главной — не рендерится, пока нет ни одной опубликованной работы. */
export default function OriginalsShowcase() {
  const { t } = useTranslation()
  const [mangas, setMangas] = useState<PublicManga[] | null>(null)

  useEffect(() => {
    // "new" — сортировка по дате публикации (updatedAt на бэкенде, см.
    // routes/originals.ts), не по дате создания черновика: чтобы здесь
    // сразу было видно то, что только что прошло модерацию.
    getPublicMangas({ sort: 'new' }).then(setMangas)
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
