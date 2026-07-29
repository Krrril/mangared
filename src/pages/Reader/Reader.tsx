import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, Sun, Settings, List, ExternalLink } from 'lucide-react'
import { getChapterById, getChapterPages, getTitleById } from '../../services/content'
import type { Chapter, Title } from '../../services/content'
import { saveProgress } from '../../services/progress'
import styles from './Reader.module.css'

type Mode = 'horizontal' | 'vertical'
type Direction = 'ltr' | 'rtl'

export default function Reader() {
  const { titleId, chapterId } = useParams<{ titleId: string; chapterId: string }>()

  const [title, setTitle] = useState<Title | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [pageUrls, setPageUrls] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [mode, setMode] = useState<Mode>('horizontal')
  const [direction, setDirection] = useState<Direction>('ltr')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!titleId || !chapterId) return
    setChapter(null)
    setPageUrls([])
    setPageIndex(0)
    getTitleById(titleId).then((res) => setTitle(res ?? null))
    getChapterById(titleId, chapterId).then((res) => setChapter(res ?? null))
  }, [titleId, chapterId])

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

  const goNext = () => setPageIndex((i) => Math.min(totalPages - 1, i + 1))
  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1))

  const clickZones = useMemo(
    () => (direction === 'ltr' ? { left: goPrev, right: goNext } : { left: goNext, right: goPrev }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [direction, totalPages],
  )

  if (!title || !chapter) {
    return <div className={styles.loading}>Загрузка...</div>
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
          <div style={{ width: 36 }} />
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
          </div>
        )}
      </div>

      <footer className={styles.bottomBar}>
        {mode === 'horizontal' && (
          <div className={styles.navControls}>
            <button type="button" onClick={goPrev} disabled={pageIndex === 0} aria-label="prev page">
              <ChevronLeft size={18} />
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, totalPages - 1)}
              value={pageIndex}
              onChange={(e) => setPageIndex(Number(e.target.value))}
              className={styles.slider}
            />
            <button type="button" onClick={goNext} disabled={pageIndex === totalPages - 1} aria-label="next page">
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
