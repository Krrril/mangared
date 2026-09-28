import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Heart, Star, ExternalLink, Eye, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import SeoHead from '../../components/SeoHead'
import ReactionButtons from '../../components/ReactionButtons'
import CommentSection from '../../components/CommentSection'
import LanguageBadge from '../../components/LanguageBadge'
import ReadingLanguageSwitcher from '../../components/ReadingLanguageSwitcher'
import { getChapters, getTitleById } from '../../services/content'
import type { Chapter, Title } from '../../services/content'
import { isFavorite, toggleFavorite } from '../../services/favorites'
import { getStoredToken } from '../../services/auth/token'
import { getStats } from '../../services/stats/api'
import type { TitleStats } from '../../services/stats/api'
import { formatCount } from '../../utils/formatCount'
import { pickReadingLanguage, READ_PARAM, storeReadingLanguage } from '../../services/readingLanguage'
import styles from './TitlePage.module.css'

export default function TitlePage() {
  const { titleId } = useParams<{ titleId: string }>()
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [title, setTitle] = useState<Title | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(true)
  const [favorite, setFavorite] = useState(false)
  const [stats, setStats] = useState<TitleStats>({ views: 0, favorites: 0 })

  const requestedLang = searchParams.get(READ_PARAM)
  const uiLang = i18n.resolvedLanguage ?? i18n.language
  // Язык чтения — отдельно от языка интерфейса (?lang=): ?read= -> запомненный -> язык интерфейса -> английский/первый.
  const readingLang = title
    ? pickReadingLanguage({
        available: title.languages,
        primary: 'en',
        uiLang,
        titleId: title.id,
        requested: requestedLang,
      }) ?? 'en'
    : null

  useEffect(() => {
    if (!titleId) return
    getTitleById(titleId).then((res) => setTitle(res ?? null))
    isFavorite(titleId).then(setFavorite)
    getStats([titleId]).then((s) => setStats(s[titleId] ?? { views: 0, favorites: 0 }))
  }, [titleId])

  // Главы грузятся под выбранный язык; при смене языка старый список не показываем.
  useEffect(() => {
    if (!titleId || !readingLang) return
    let cancelled = false
    setChapters([])
    // Пока идёт загрузка (в том числе после смены языка), показываем скелетон,
    // а заглушку "нет глав на этом языке" — только когда загрузка завершилась.
    setChaptersLoading(true)
    getChapters(titleId, readingLang)
      .then((res) => {
        if (!cancelled) setChapters(res)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChaptersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [titleId, readingLang])

  function handleChangeLanguage(language: string) {
    if (!titleId) return
    storeReadingLanguage(titleId, language)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(READ_PARAM, language)
        return next
      },
      { replace: true },
    )
  }

  const handleToggleFavorite = () => {
    if (!titleId) return
    // Счётчик избранного на бэкенде считает только вошедших пользователей
    // (гостевое избранное — только localStorage, см. services/favorites) —
    // не показываем оптимистичный +1 гостю, иначе число "откатится" при
    // следующей загрузке страницы и будет выглядеть как баг.
    const isLoggedIn = !!getStoredToken()
    toggleFavorite(titleId).then((newValue) => {
      setFavorite(newValue)
      if (isLoggedIn) {
        setStats((prev) => ({ ...prev, favorites: Math.max(0, prev.favorites + (newValue ? 1 : -1)) }))
      }
    })
  }

  if (!title) {
    return (
      <MainLayout>
        <p className={styles.loading}>{t('common.loading')}</p>
      </MainLayout>
    )
  }

  const latestReadableChapter = chapters.find((c) => !c.isExternal)

  // chapters отсортированы по убыванию (см. getChapterFeed) — самая
  // маленькая по номеру глава оказывается последней в массиве. Если она
  // больше 1, значит начало тайтла на MangaDex для этого перевода
  // отсутствует целиком (не выложено вообще, даже как внешняя ссылка) —
  // подсказываем пользователю, чтобы это не читалось как баг приложения.
  const minChapterNumber = chapters.length > 0 ? chapters[chapters.length - 1].number : null
  const missingChaptersUpTo =
    minChapterNumber !== null && minChapterNumber > 1 ? Math.ceil(minChapterNumber) - 1 : null

  return (
    <MainLayout>
      <SeoHead
        title={t('seo.titlePage.titleTemplate', { name: title.name })}
        description={t('seo.titlePage.descriptionTemplate', { name: title.name, genre: title.genres[0] ?? '' })}
      />
      <div className={styles.header}>
        <div className={styles.coverWrap}>
          <CoverPlaceholder
            cover={title.cover}
            name={title.name}
            imageUrl={title.coverUrlLarge}
            className={styles.cover}
          />
          {readingLang && <LanguageBadge languages={[readingLang]} />}
        </div>
        <div className={styles.info}>
          <h1 className={styles.name}>{title.name}</h1>
          <p className={styles.meta}>
            {title.author || t('title.authorUnknown')}
            {title.artist && ` · ${title.artist}`}
          </p>
          <div className={styles.tags}>
            <span className={styles.rating}>
              <Star size={14} fill="currentColor" />
              {title.rating.toFixed(1)}
            </span>
            <span className={styles.pill}>{t(`creator.contentType.${title.type}`)}</span>
            {title.genres.map((g) => (
              <span key={g} className={styles.pill}>
                {g}
              </span>
            ))}
            {stats.views > 0 && (
              <span className={styles.rating} title={t('stats.views') ?? ''}>
                <Eye size={14} />
                {formatCount(stats.views)}
              </span>
            )}
          </div>
          <p className={styles.description}>{title.description}</p>
          {readingLang && <ReadingLanguageSwitcher languages={title.languages} value={readingLang} onChange={handleChangeLanguage} />}
          <div className={styles.actions}>
            {latestReadableChapter && (
              <Link to={`/title/${title.id}/read/${latestReadableChapter.id}`} className={styles.readButton}>
                {t('common.read')}
              </Link>
            )}
            <div className={styles.favoriteWrap}>
              <button
                type="button"
                className={`${styles.favoriteButton} ${favorite ? styles.favoriteButtonActive : ''}`}
                aria-label={t('a11y.favorite') ?? ''}
                aria-pressed={favorite}
                onClick={handleToggleFavorite}
              >
                <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
              </button>
              {stats.favorites > 0 && (
                <span className={styles.favoriteCount} title={t('stats.favorites') ?? ''}>
                  {formatCount(stats.favorites)}
                </span>
              )}
            </div>
            <ReactionButtons mangaId={title.id} />
          </div>
        </div>
      </div>

      <section>
        <h2 className={styles.sectionTitle}>
          {t('title.chapters')} {!chaptersLoading && <span className={styles.count}>{chapters.length}</span>}
        </h2>
        {!chaptersLoading && missingChaptersUpTo !== null && (
          <p className={styles.missingHint}>
            {missingChaptersUpTo === 1
              ? t('title.chapterMissingSingle')
              : t('title.chaptersMissingRange', { to: missingChaptersUpTo })}
          </p>
        )}
        {chaptersLoading ? (
          <div className={styles.chapterList} aria-busy="true" aria-label={t('common.loading') ?? ''}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={styles.chapterSkeleton} />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <div className={styles.emptyChapters}>
            <Languages size={28} />
            <p>{t('title.noChaptersInLanguage')}</p>
            <a
              href={`https://mangadex.org/title/${title.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.emptyChaptersLink}
            >
              {t('title.viewOnMangadex')}
              <ExternalLink size={14} />
            </a>
          </div>
        ) : (
          <div className={styles.chapterList}>
            {chapters.map((chapter, i) => (
              <ChapterRow key={chapter.id} chapter={chapter} titleId={title.id} isLatest={i === 0} />
            ))}
          </div>
        )}
      </section>

      <CommentSection mangaId={title.id} />
    </MainLayout>
  )
}

function ChapterRow({ chapter, titleId, isLatest }: { chapter: Chapter; titleId: string; isLatest: boolean }) {
  const { t } = useTranslation()
  const date = new Date(chapter.releasedAt).toLocaleDateString('ru-RU')

  const label = (
    <span className={styles.chapterName}>
      {t('common.chapter', { number: chapter.number })}
      {isLatest && <span className={styles.newTag}>{t('common.new')}</span>}
      {chapter.scanlationGroup && <span className={styles.groupName}>{chapter.scanlationGroup}</span>}
      {chapter.alternateIds && chapter.alternateIds.length > 0 && (
        <span className={styles.altCount} title={t('title.altTranslationsTooltip') ?? ''}>
          +{chapter.alternateIds.length}
        </span>
      )}
    </span>
  )

  if (chapter.isExternal && chapter.externalUrl) {
    return (
      <div className={styles.chapterExternalWrap}>
        <a href={chapter.externalUrl} target="_blank" rel="noopener noreferrer" className={styles.chapterRow}>
          {label}
          <span className={styles.chapterExternal}>
            {t('title.readExternal')}
            <ExternalLink size={13} />
          </span>
        </a>
        {chapter.alternateExternalLinks && chapter.alternateExternalLinks.length > 0 && (
          <p className={styles.chapterMirrors}>
            {t('title.mirrorsLabel')}{' '}
            {chapter.alternateExternalLinks.map((mirror, i) => (
              <span key={mirror.url}>
                {i > 0 && ', '}
                <a href={mirror.url} target="_blank" rel="noopener noreferrer">
                  {mirror.label}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    )
  }

  return (
    <Link to={`/title/${titleId}/read/${chapter.id}`} className={styles.chapterRow}>
      {label}
      <span className={styles.chapterDate}>{date}</span>
    </Link>
  )
}
