import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import RightPanel from '../../layouts/RightPanel'
import HeroBanner from '../../components/HeroBanner'
import PublishHero from '../../components/PublishHero'
import RandomFeed from '../../components/RandomFeed'
import OriginalsShowcase from '../../components/OriginalsShowcase'
import TitleCard from '../../components/TitleCard'
import CategoryChip from '../../components/CategoryChip'
import ContinueReadingRow from '../../components/ContinueReadingRow'
import {
  getCategories,
  getContinueReading,
  getFeaturedTitles,
  getNewReleases,
  getPopularToday,
} from '../../services/content'
import type { Category, ContinueReadingEntry, Title } from '../../services/content'
import styles from './Home.module.css'

export default function Home() {
  const { t } = useTranslation()
  const [featured, setFeatured] = useState<Title[]>([])
  const [popular, setPopular] = useState<Title[]>([])
  const [newReleases, setNewReleases] = useState<Title[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [continueReading, setContinueReading] = useState<ContinueReadingEntry[]>([])

  useEffect(() => {
    getFeaturedTitles().then(setFeatured)
    getPopularToday().then(setPopular)
    getNewReleases().then(setNewReleases)
    getCategories().then(setCategories)
    getContinueReading().then(setContinueReading)
  }, [])

  return (
    <MainLayout rightPanel={<RightPanel />}>
      <PublishHero />

      {featured.length > 0 && <HeroBanner titles={featured} />}

      <OriginalsShowcase />

      <RandomFeed />

      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('sections.popularToday')}</h2>
          <Link to="/top" className={styles.seeAll}>
            {t('sections.seeAll')} <ChevronRight size={16} />
          </Link>
        </div>
        <div className={styles.grid}>
          {popular.map((title) => (
            <TitleCard key={title.id} title={title} />
          ))}
        </div>
      </section>

      {continueReading.length > 0 && (
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('sections.continueReading')}</h2>
            <button type="button" className={styles.seeAll}>
              {t('sections.seeAll')} <ChevronRight size={16} />
            </button>
          </div>
          <div className={styles.continueRow}>
            {continueReading.map((entry) => (
              <ContinueReadingRow key={entry.title.id} title={entry.title} progress={entry.progress} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={styles.sectionTitle}>{t('sections.categories')}</h2>
        <div className={styles.chipRow}>
          {categories.map((c) => (
            <CategoryChip key={c.id} id={c.id} label={c.name} />
          ))}
        </div>
      </section>

      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('sections.newReleases')}</h2>
          <button type="button" className={styles.seeAll}>
            {t('sections.seeAll')} <ChevronRight size={16} />
          </button>
        </div>
        <div className={styles.grid}>
          {newReleases.map((title) => (
            <TitleCard key={title.id} title={title} />
          ))}
        </div>
      </section>
    </MainLayout>
  )
}
