import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Heart, Star, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import { getChapters, getTitleById } from '../../services/content'
import type { Chapter, Title } from '../../services/content'
import { isFavorite, toggleFavorite } from '../../services/favorites'
import styles from './TitlePage.module.css'

export default function TitlePage() {
  const { titleId } = useParams<{ titleId: string }>()
  const { t } = useTranslation()
  const [title, setTitle] = useState<Title | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    if (!titleId) return
    getTitleById(titleId).then((res) => setTitle(res ?? null))
    getChapters(titleId).then(setChapters)
    isFavorite(titleId).then(setFavorite)
  }, [titleId])

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
      <div className={styles.header}>
        <CoverPlaceholder
          cover={title.cover}
          name={title.name}
          imageUrl={title.coverUrlLarge}
          className={styles.cover}
        />
        <div className={styles.info}>
          <h1 className={styles.name}>{title.name}</h1>
          <p className={styles.meta}>
            {title.author}
            {title.artist && ` · ${title.artist}`}
          </p>
          <div className={styles.tags}>
            <span className={styles.rating}>
              <Star size={14} fill="currentColor" />
              {title.rating.toFixed(1)}
            </span>
            <span className={styles.pill}>{title.type}</span>
            {title.genres.map((g) => (
              <span key={g} className={styles.pill}>
                {g}
              </span>
            ))}
          </div>
          <p className={styles.description}>{title.description}</p>
          <div className={styles.actions}>
            {latestReadableChapter && (
              <Link to={`/title/${title.id}/read/${latestReadableChapter.id}`} className={styles.readButton}>
                {t('common.read')}
              </Link>
            )}
            <button
              type="button"
              className={`${styles.favoriteButton} ${favorite ? styles.favoriteButtonActive : ''}`}
              aria-label="favorite"
              aria-pressed={favorite}
              onClick={() => toggleFavorite(title.id).then(setFavorite)}
            >
              <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>

      <section>
        <h2 className={styles.sectionTitle}>
          {t('title.chapters')} <span className={styles.count}>{chapters.length}</span>
        </h2>
        {missingChaptersUpTo !== null && (
          <p className={styles.missingHint}>
            {missingChaptersUpTo === 1
              ? t('title.chapterMissingSingle')
              : t('title.chaptersMissingRange', { to: missingChaptersUpTo })}
          </p>
        )}
        <div className={styles.chapterList}>
          {chapters.map((chapter, i) => (
            <ChapterRow key={chapter.id} chapter={chapter} titleId={title.id} isLatest={i === 0} />
          ))}
        </div>
      </section>
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
        <span className={styles.altCount} title="Другие переводы этой главы от других групп">
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
