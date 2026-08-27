import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, Sun, Settings, List, ExternalLink, BookOpenCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getChapterById, getChapterPages, getChapters, getTitleById } from '../../services/content'
import type { Chapter, Title } from '../../services/content'
import { saveProgress } from '../../services/progress'
import { getPublicChapter, getPublicManga } from '../../services/originals/api'
import { mapPublicChapterToChapter, mapPublicChapterSummaryToChapter, mapPublicMangaToTitle } from '../../services/reader/adapter'
import { recordChapterView } from '../../services/stats/api'
import { useAuth } from '../../services/auth/AuthContext'
import { deleteAdminPage } from '../../services/admin/api'
import ReaderPageImage from '../../components/ReaderPageImage'
import styles from './Reader.module.css'

type Mode = 'horizontal' | 'vertical'
type Direction = 'ltr' | 'rtl'

export default function Reader() {
  const { titleId, chapterId } = useParams<{ titleId: string; chapterId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { user, token } = useAuth()

  // Один и тот же компонент читалки для каталога MangaDex (/title/...) и
  // авторского контента (/originals/...) — источник данных отличается, вся
  // остальная логика (пролистывание, конец главы, next/prev) общая.
  const isOriginals = location.pathname.startsWith('/originals/')
  const basePath = isOriginals ? '/originals' : '/title'

  const [title, setTitle] = useState<Title | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [pageUrls, setPageUrls] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [brightness, setBrightness] = useState(100)
  // Вертикальный режим — дефолт для любого тайтла (и MangaDex, и Originals),
  // независимо от заявленного типа контента (манга/манхва/комикс): авторы
  // Originals не всегда корректно выставляют тип при публикации, а MangaDex
  // вообще не несёт для читалки понятия направления. Горизонтальный режим
  // и его направление — только ручная опция в настройках ниже.
  const [mode, setMode] = useState<Mode>('vertical')
  const [direction, setDirection] = useState<Direction>('ltr')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chapterList, setChapterList] = useState<Chapter[]>([])
  const [showChapterEnd, setShowChapterEnd] = useState(false)
  // Сколько раз уже запрашивали новую at-home сессию (см. handlePageExhausted
  // ниже) для текущей главы — ограничиваем, чтобы битый узел не заставил нас
  // бесконечно долбить API, если не повезёт с новым узлом тоже пару раз подряд.
  const sessionRefreshCount = useRef(0)

  useEffect(() => {
    if (!titleId || !chapterId) return
    setChapter(null)
    setPageUrls([])
    setPageIndex(0)
    setShowChapterEnd(false)
    sessionRefreshCount.current = 0

    if (isOriginals) {
      getPublicChapter(titleId, chapterId).then((res) => {
        setChapter(mapPublicChapterToChapter(res))
        setPageUrls(res.pages)
      })
    } else {
      getTitleById(titleId).then((res) => setTitle(res ?? null))
      getChapterById(titleId, chapterId).then((res) => setChapter(res ?? null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleId, chapterId, isOriginals])

  // Полный список глав тайтла — нужен, чтобы найти следующую/предыдущую
  // главу по порядку номеров (список уже дедуплицирован по группам
  // сканлейта, см. groupAndDedupeChapters в api/mangadex/chapters.ts).
  // Грузим один раз на тайтл, не на каждую главу. Для Originals заодно
  // приходит и сам тайтл — MangaDex-ветка получает его отдельным запросом
  // (см. выше), поэтому setTitle здесь только для Originals-ветки.
  useEffect(() => {
    if (!titleId) return
    if (isOriginals) {
      getPublicManga(titleId).then((manga) => {
        setTitle(mapPublicMangaToTitle(manga))
        // Бэкенд отдаёт главы по возрастанию (удобно для оглавления на
        // странице тайтла) — next/prev-логика ниже по файлу, как и у
        // MangaDex, ожидает убывающий порядок (индекс 0 — самая новая).
        setChapterList(
          manga.chapters
            .slice()
            .reverse()
            .map((c) => mapPublicChapterSummaryToChapter(c, manga.id)),
        )
      })
    } else {
      getChapters(titleId).then(setChapterList)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleId, isOriginals])

  useEffect(() => {
    if (isOriginals || !chapter || chapter.isExternal) return
    // Ссылки на страницы запрашиваются только сейчас, при открытии главы —
    // не заранее и не пакетно (см. src/api/mangadex/chapters.ts). Для
    // Originals страницы уже приходят вместе с главой (см. эффект выше).
    getChapterPages(chapter.id).then(setPageUrls)
  }, [chapter, isOriginals])

  useEffect(() => {
    // titleId годится как mangaId для обоих источников — маршруты
    // /title/:titleId/read/... и /originals/:titleId/read/... оба несут
    // его в одном и том же параметре. Лицензированные (isExternal) главы
    // не читаются у нас — не засчитываем их как "просмотр".
    if (!titleId || !chapter || chapter.isExternal) return
    recordChapterView(titleId, chapter.id, isOriginals ? 'original' : 'mangadex')
  }, [titleId, chapter, isOriginals])

  const totalPages = pageUrls.length

  const MAX_SESSION_REFRESHES = 2
  // Страница исчерпала все повторы на текущем узле @Home — вероятно, узлу
  // не повезло целиком на эту главу (все страницы главы раздаёт один и тот
  // же узел, см. ReaderPageImage). Просим MangaDex назначить новую сессию
  // (обычно — другой узел) для всей главы: если узел был просто временно
  // плох, "мёртвые" картинки на экране сами обновятся, как только придёт
  // новый pageUrls (src меняется — ReaderPageImage сам сбрасывает свой
  // "failed" и пробует заново).
  function handlePageExhausted() {
    if (isOriginals || !chapter) return
    if (sessionRefreshCount.current >= MAX_SESSION_REFRESHES) return
    sessionRefreshCount.current += 1
    getChapterPages(chapter.id).then(setPageUrls)
  }

  useEffect(() => {
    // Прогресс чтения авторского контента пока не пишем в общий
    // ReadingProgress — "Continue Reading" на главной резолвит записи через
    // MangaDex-каталог (getTitleById), и Originals-тайтл там не найдётся.
    if (isOriginals || !title || !chapter || totalPages === 0) return
    saveProgress({
      titleId: title.id,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      pageNumber: pageIndex,
      updatedAt: new Date().toISOString(),
    }).catch(console.error)
  }, [title, chapter, pageIndex, totalPages, isOriginals])

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
    navigate(`${basePath}/${title.id}/read/${target.id}`)
  }

  const isAdminView = isOriginals && !!user?.isAdmin

  async function handleDeletePage(index: number) {
    if (!token || !chapter) return
    if (!window.confirm(`Удалить страницу ${index + 1}? Это необратимо.`)) return
    const result = await deleteAdminPage(token, chapter.id, index).catch((err) => {
      window.alert(err instanceof Error ? err.message : 'Не удалось удалить страницу')
      return null
    })
    if (!result) return
    setPageUrls(result.pages)
    setPageIndex((i) => Math.min(i, Math.max(0, result.pages.length - 1)))
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
          <Link to={`${basePath}/${title.id}`} className={styles.backButton} aria-label="back">
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
        <Link to={`${basePath}/${title.id}`} className={styles.backButton} aria-label="back">
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
              titleHref={`${basePath}/${title.id}`}
              onGoToChapter={goToChapter}
            />
          ) : (
            <div className={styles.page}>
              <button type="button" className={styles.clickZoneLeft} onClick={clickZones.left} aria-label="prev" />
              <button type="button" className={styles.clickZoneRight} onClick={clickZones.right} aria-label="next" />
              <ReaderPageImage
                src={pageUrls[pageIndex]}
                alt={`Страница ${pageIndex + 1}`}
                className={styles.pageImage}
                onExhausted={handlePageExhausted}
              />
              {isAdminView && (
                <button
                  type="button"
                  className={styles.adminDeletePageButton}
                  aria-label="delete page"
                  title="Удалить эту страницу (админ)"
                  onClick={() => handleDeletePage(pageIndex)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )
        ) : (
          <div className={styles.verticalScroll}>
            {pageUrls.map((url, i) => (
              <div key={url} className={styles.pageImageVerticalWrap}>
                <ReaderPageImage
                  src={url}
                  alt={`Страница ${i + 1}`}
                  className={styles.pageImageVertical}
                  onExhausted={handlePageExhausted}
                />
                {isAdminView && (
                  <button
                    type="button"
                    className={styles.adminDeletePageButton}
                    aria-label="delete page"
                    title="Удалить эту страницу (админ)"
                    onClick={() => handleDeletePage(i)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <ChapterEndBlock
              t={t}
              chapter={chapter}
              nextChapter={nextChapter}
              prevChapter={prevChapter}
              isLastAvailableChapter={isLastAvailableChapter}
              skippedChapterNumber={skippedChapterNumber}
              titleHref={`${basePath}/${title.id}`}
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
  titleHref: string
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
  titleHref,
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
            <Link to={titleHref} className={styles.chapterEndPrimary}>
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
