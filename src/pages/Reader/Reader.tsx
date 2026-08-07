import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, Sun, Settings, List, ExternalLink, BookOpenCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getChapterById, getChapterPages, getChapters, getTitleById } from '../../services/content'
import type { Chapter, Title } from '../../services/content'
import { saveProgress } from '../../services/progress'
import styles from './Reader.module.css'

type Mode = 'horizontal' | 'vertical'
type Direction = 'ltr' | 'rtl'

export default function Reader() {
  const { titleId, chapterId } = useParams<{ titleId: string; chapterId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [title, setTitle] = useState<Title | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [pageUrls, setPageUrls] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [mode, setMode] = useState<Mode>('horizontal')
  const [direction, setDirection] = useState<Direction>('ltr')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chapterList, setChapterList] = useState<Chapter[]>([])
  const [showChapterEnd, setShowChapterEnd] = useState(false)

  useEffect(() => {
    if (!titleId || !chapterId) return
    setChapter(null)
    setPageUrls([])
    setPageIndex(0)
    setShowChapterEnd(false)
    getTitleById(titleId).then((res) => setTitle(res ?? null))
    getChapterById(titleId, chapterId).then((res) => setChapter(res ?? null))
  }, [titleId, chapterId])

  // Полный список глав тайтла — нужен, чтобы найти следующую/предыдущую
  // главу по порядку номеров (список уже дедуплицирован по группам
  // сканлейта, см. groupAndDedupeChapters в api/mangadex/chapters.ts).
  // Грузим один раз на тайтл, не на каждую главу.
  useEffect(() => {
    if (!titleId) return
    getChapters(titleId).then(setChapterList)
  }, [titleId])

  useEffect(() => {
    if (!chapter || chapter.isExternal) return
    // Ссылки на страницы запрашиваются только сейчас, при открытии главы —
    // не заранее и не пакетно (см. src/api/mangadex/chapters.ts)
    getChapterPages(chapter.id).then(setPageUrls)
  }, [chapter])

  const totalPages = pageUrls.length

  useEffect(() => {
    if (!title || !chapter || totalPages === 0) return
    saveProgress({
      titleId: title.id,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      pageNumber: pageIndex,
      updatedAt: new Date().toISOString(),
    }).catch(console.error)
  }, [title, chapter, pageIndex, totalPages])

  // chapterList отсортирован по убыванию номера (order[chapter]=desc) —
  // следующая по чтению глава оказывается ПЕРЕД текущей в массиве,
  // предыдущая — ПОСЛЕ. Раз список содержит только реально существующие
  // главы, "следующий элемент массива" уже сам по себе пропускает дыры
  // (см. п.4 в задаче) — ничего искать по номеру вручную не нужно.
  const currentChapterIndex = chapter ? chapterList.findIndex((c) => c.id === chapter.id) : -1
  const nextChapter = currentChapterIndex > 0 ? chapterList[currentChapterIndex - 1] : undefined
  const prevChapter =
    currentChapterIndex !== -1 && currentChapterIndex < chapterList.length - 1
      ? chapterList[currentChapterIndex + 1]
      : undefined
  const isLastAvailableChapter = currentChapterIndex === 0
  const skippedChapterNumber =
    chapter && nextChapter && Number.isInteger(chapter.number) && Number.isInteger(nextChapter.number) && nextChapter.number - chapter.number > 1
      ? chapter.number + 1
      : null

  const goToChapter = (target: Chapter | undefined) => {
    if (!title || !target) return
    navigate(`/title/${title.id}/read/${target.id}`)
  }

  const goNext = () => {
    if (pageIndex >= totalPages - 1) {
      setShowChapterEnd(true)
      return
    }
    setPageIndex((i) => Math.min(totalPages - 1, i + 1))
  }
  const goPrev = () => {
    if (showChapterEnd) {
      setShowChapterEnd(false)
      return
    }
    setPageIndex((i) => Math.max(0, i - 1))
  }

  const clickZones = useMemo(
    () => (direction === 'ltr' ? { left: goPrev, right: goNext } : { left: goNext, right: goPrev }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [direction, totalPages, showChapterEnd],
  )

  if (!title || !chapter) {
    return <div className={styles.loading}>{t('common.loading')}</div>
  }

  if (chapter.isExternal) {
    return (
      <div className={styles.reader}>
        <header className={styles.topbar}>
          <Link to={`/title/${title.id}`} className={styles.backButton} aria-label="back">
            <ArrowLeft size={20} />
          </Link>
          <div className={styles.titleBlock}>
            <p className={styles.titleName}>{title.name}</p>
            <p className={styles.chapterName}>Глава {chapter.number}</p>
          </div>
          <div className={styles.topbarChapterNav}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => goToChapter(prevChapter)}
              disabled={!prevChapter}
              aria-label={t('reader.prevChapter') ?? ''}
              title={t('reader.prevChapter') ?? ''}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => goToChapter(nextChapter)}
              disabled={!nextChapter}
              aria-label={t('reader.nextChapter') ?? ''}
              title={t('reader.nextChapter') ?? ''}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>
        <div className={styles.externalNotice}>
          <ExternalLink size={32} />
          <p>Эта глава лицензирована и хранится не на MangaDex — открыть её можно только на сайте правообладателя.</p>
          {chapter.externalUrl && (
            <a href={chapter.externalUrl} target="_blank" rel="noopener noreferrer" className={styles.externalButton}>
              Читать на сайте
            </a>
          )}
        </div>
      </div>
    )
  }

  if (totalPages === 0) {
    return <div className={styles.loading}>Загрузка страниц...</div>
  }

  return (
    <div className={styles.reader}>
      <header className={styles.topbar}>
        <Link to={`/title/${title.id}`} className={styles.backButton} aria-label="back">
          <ArrowLeft size={20} />
        </Link>
        <div className={styles.titleBlock}>
          <p className={styles.titleName}>{title.name}</p>
          <p className={styles.chapterName}>Глава {chapter.number}</p>
        </div>
        <div className={styles.topbarChapterNav}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => goToChapter(prevChapter)}
            disabled={!prevChapter}
            aria-label={t('reader.prevChapter') ?? ''}
            title={t('reader.prevChapter') ?? ''}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => goToChapter(nextChapter)}
            disabled={!nextChapter}
            aria-label={t('reader.nextChapter') ?? ''}
            title={t('reader.nextChapter') ?? ''}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="settings"
        >
          <Settings size={18} />
        </button>
      </header>

      <div className={styles.viewport} style={{ filter: `brightness(${brightness}%)` }}>
        {mode === 'horizontal' ? (
          showChapterEnd ? (
            <ChapterEndBlock
              t={t}
              chapter={chapter}
              nextChapter={nextChapter}
              prevChapter={prevChapter}
              isLastAvailableChapter={isLastAvailableChapter}
              skippedChapterNumber={skippedChapterNumber}
              titleId={title.id}
              onGoToChapter={goToChapter}
            />
          ) : (
            <div className={styles.page}>
              <button type="button" className={styles.clickZoneLeft} onClick={clickZones.left} aria-label="prev" />
              <button type="button" className={styles.clickZoneRight} onClick={clickZones.right} aria-label="next" />
              <img
                src={pageUrls[pageIndex]}
                alt={`Страница ${pageIndex + 1}`}
                className={styles.pageImage}
                referrerPolicy="no-referrer"
              />
            </div>
          )
        ) : (
          <div className={styles.verticalScroll}>
            {pageUrls.map((url, i) => (
              <img
                key={url}
                src={url}
                alt={`Страница ${i + 1}`}
                className={styles.pageImageVertical}
                referrerPolicy="no-referrer"
              />
            ))}
            <ChapterEndBlock
              t={t}
              chapter={chapter}
              nextChapter={nextChapter}
              prevChapter={prevChapter}
              isLastAvailableChapter={isLastAvailableChapter}
              skippedChapterNumber={skippedChapterNumber}
              titleId={title.id}
              onGoToChapter={goToChapter}
              inline
            />
          </div>
        )}
      </div>

      <footer className={styles.bottomBar}>
        {mode === 'horizontal' && (
          <div className={styles.navControls}>
            <button type="button" onClick={goPrev} disabled={pageIndex === 0 && !showChapterEnd} aria-label="prev page">
              <ChevronLeft size={18} />
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, totalPages - 1)}
              value={pageIndex}
              onChange={(e) => {
                setShowChapterEnd(false)
                setPageIndex(Number(e.target.value))
              }}
              className={styles.slider}
            />
            <button type="button" onClick={goNext} aria-label="next page">
              <ChevronRight size={18} />
            </button>
            <span className={styles.pageCounter}>
              {pageIndex + 1} / {totalPages}
            </span>
          </div>
        )}
        <div className={styles.toolIcons}>
          <button type="button" className={styles.toolButton} aria-label="content">
            <List size={18} />
          </button>
          <label className={styles.brightnessControl}>
            <Sun size={18} />
            <input
              type="range"
              min={30}
              max={100}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
            />
          </label>
        </div>
      </footer>

      {settingsOpen && (
        <div className={styles.settingsPanel}>
          <h3 className={styles.settingsHeading}>Настройки чтения</h3>

          <p className={styles.settingsLabel}>Режим чтения</p>
          <div className={styles.segmented}>
            <button
              type="button"
              className={mode === 'vertical' ? styles.segmentActive : styles.segment}
              onClick={() => setMode('vertical')}
            >
              Вертикальный
            </button>
            <button
              type="button"
              className={mode === 'horizontal' ? styles.segmentActive : styles.segment}
              onClick={() => setMode('horizontal')}
            >
              Горизонтальный
            </button>
          </div>

          {mode === 'horizontal' && (
            <>
              <p className={styles.settingsLabel}>Направление</p>
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={direction === 'ltr' ? styles.segmentActive : styles.segment}
                  onClick={() => setDirection('ltr')}
                >
                  Слева направо
                </button>
                <button
                  type="button"
                  className={direction === 'rtl' ? styles.segmentActive : styles.segment}
                  onClick={() => setDirection('rtl')}
                >
                  Справа налево
                </button>
              </div>
            </>
          )}

          {chapter.scanlationGroup && (
            <p className={styles.attribution}>Перевод: {chapter.scanlationGroup}</p>
          )}

          <button type="button" className={styles.closeSettings} onClick={() => setSettingsOpen(false)}>
            Готово
          </button>
        </div>
      )}
    </div>
  )
}

interface ChapterEndBlockProps {
  t: (key: string, opts?: Record<string, unknown>) => string
  chapter: Chapter
  nextChapter: Chapter | undefined
  prevChapter: Chapter | undefined
  isLastAvailableChapter: boolean
  skippedChapterNumber: number | null
  titleId: string
  onGoToChapter: (target: Chapter | undefined) => void
  /** true — встроен в конец вертикальной ленты страниц, false — во всю высоту (горизонтальный режим) */
  inline?: boolean
}

/**
 * Экран/блок конца главы — общий для горизонтального режима (заменяет
 * последнюю страницу после клика "вперёд") и вертикального (просто идёт
 * последним элементом ленты, достигается обычным скроллом).
 */
function ChapterEndBlock({
  t,
  chapter,
  nextChapter,
  prevChapter,
  isLastAvailableChapter,
  skippedChapterNumber,
  titleId,
  onGoToChapter,
  inline,
}: ChapterEndBlockProps) {
  return (
    <div className={`${styles.chapterEnd} ${inline ? styles.chapterEndInline : ''}`}>
      <BookOpenCheck size={32} />
      <p className={styles.chapterEndHeading}>{t('reader.chapterEnd', { number: chapter.number })}</p>

      {skippedChapterNumber !== null && nextChapter && (
        <p className={styles.chapterEndSkipped}>
          {t('reader.chapterSkipped', { skipped: skippedChapterNumber, next: nextChapter.number })}
        </p>
      )}

      <div className={styles.chapterEndActions}>
        {nextChapter ? (
          <button type="button" className={styles.chapterEndPrimary} onClick={() => onGoToChapter(nextChapter)}>
            {t('reader.readNextChapter', { number: nextChapter.number })}
            <ChevronRight size={18} />
          </button>
        ) : isLastAvailableChapter ? (
          <>
            <p className={styles.chapterEndLast}>{t('reader.lastChapterNotice')}</p>
            <Link to={`/title/${titleId}`} className={styles.chapterEndPrimary}>
              {t('reader.backToTitle')}
            </Link>
          </>
        ) : null}

        {prevChapter && (
          <button type="button" className={styles.chapterEndSecondary} onClick={() => onGoToChapter(prevChapter)}>
            <ChevronLeft size={16} />
            {t('reader.backToPrevChapter', { number: prevChapter.number })}
          </button>
        )}
      </div>
    </div>
  )
}
