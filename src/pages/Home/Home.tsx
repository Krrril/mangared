import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import RightPanel from '../../layouts/RightPanel'
import SeoHead from '../../components/SeoHead'
import HeroBanner from '../../components/HeroBanner'
import PublishHero from '../../components/PublishHero'
import RandomFeed from '../../components/RandomFeed'
import OriginalsShowcase from '../../components/OriginalsShowcase'
import TitleCard from '../../components/TitleCard'
import SkeletonCard from '../../components/SkeletonCard'
import CategoryCard from '../../components/CategoryCard'
import HorizontalScroller from '../../components/HorizontalScroller'
import ContinueReadingRow from '../../components/ContinueReadingRow'
import { getContinueReading, getFeaturedTitles, getNewReleases } from '../../services/content'
import { getCategoryImages } from '../../services/originals/api'
import type { CategoryImage } from '../../services/originals/api'
import { CURATED_GENRES } from '../../constants/genres'
import type { ContinueReadingEntry, Title } from '../../services/content'
import styles from './Home.module.css'

// Превью на главной — не все 15 (это уже полноценная сетка крупных
// картинок, а не мелкие чипсы, как было раньше) — "See all" ведёт на
// /categories за остальными. Первые в списке — самые частотные жанры
// (см. constants/genres.ts, порядок по частоте среди топ-400 MangaDex).
const HOME_CATEGORIES_LIMIT = 8

export default function Home() {
  const { t } = useTranslation()
  const [featured, setFeatured] = useState<Title[]>([])
  const [newReleases, setNewReleases] = useState<Title[]>([])
  const [categoryImages, setCategoryImages] = useState<CategoryImage[]>([])
  const [continueReading, setContinueReading] = useState<ContinueReadingEntry[]>([])
  // Каталог (MangaDex) грузится "живьём", без кэша на сервере — до первого
  // ответа секции просто пустовали бы, выглядело как будто сайт сломан
  // (особенно для гостя без continueReading). Держим один общий флаг вместо
  // пяти — секциям порознь скелетон не нужен, а первый же фетч почти всегда
  // тянет остальные за собой по времени.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      // Сетка карточек вместо одного слайда (см. задачу про редизайн
      // "Популярное") — limit поднят с прежних 4 (хватало на один слайд)
      // до 12, чтобы заполнить полноценную сетку, как у "Recently Added".
      getFeaturedTitles(12).then(setFeatured),
      // "Недавно добавленные" вместо топа/популярного (см. задачу про
      // фидбек от Siva) — топовые тайтлы часто либо тормозят из-за внешних
      // источников обложек, либо вообще без доступных глав (лицензионные
      // ограничения MangaDex, см. QA sweep). Свежедобавленные почти всегда
      // хотя бы с одной главой — их не публикуют пустыми. limit=12 вместо
      // прежних 8 — раньше это была витрина поменьше (getPopularToday
      // отдельно закрывала первую секцию, getNewReleases — вторую, ниже);
      // теперь секция одна, дублировать вторую такую же не стали.
      getNewReleases(12).then(setNewReleases),
      getCategoryImages().then(setCategoryImages),
      getContinueReading().then(setContinueReading),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <MainLayout rightPanel={<RightPanel />}>
      <SeoHead title={t('seo.home.title')} description={t('seo.home.description')} />
      <PublishHero />

      <OriginalsShowcase />

      <HeroBanner titles={featured} loading={loading} />

      <RandomFeed />

      <section>
        <h2 className={styles.sectionTitle}>{t('sections.recentlyAdded')}</h2>
        <div className={styles.grid}>
          {loading
            ? Array.from({ length: 12 }, (_, i) => <SkeletonCard key={i} />)
            : newReleases.map((title) => <TitleCard key={title.id} title={title} />)}
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
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('sections.categories')}</h2>
          <Link to="/categories" className={styles.seeAll}>
            {t('sections.seeAll')} <ChevronRight size={16} />
          </Link>
        </div>
        <HorizontalScroller>
          {CURATED_GENRES.slice(0, HOME_CATEGORIES_LIMIT).map((genre) => (
            <CategoryCard
              key={genre.id}
              genreId={genre.id}
              mangadexTagId={genre.mangadexTagId}
              label={t(`genres.${genre.id}`)}
              imageUrl={categoryImages.find((i) => i.genreId === genre.id)?.imageUrl}
            />
          ))}
        </HorizontalScroller>
      </section>
    </MainLayout>
  )
}
