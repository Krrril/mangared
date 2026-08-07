import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getChapterPages, getChapters, getTitleById } from '../services/content'
import type { Title } from '../services/content/types'
import CoverPlaceholder from './CoverPlaceholder'
import { useIsMobile } from '../hooks/useIsMobile'
import styles from './TitlePreviewPopover.module.css'

const PREVIEW_PAGE_COUNT = 3
const CLOSE_SWIPE_THRESHOLD = 80

interface Props {
  titleId: string
  /** Прямоугольник карточки-триггера (viewport-relative) — для позиционирования попапа на десктопе. На мобильном игнорируется, всегда bottom sheet. */
  anchorRect: DOMRect | null
  onClose: () => void
}

/**
 * Мини-превью тайтла по клику на обложку — переиспользуется и в RandomFeed
 * (лента + сетка "выпало 10"), и потенциально где угодно ещё, где есть id
 * тайтла. Десктоп — попап рядом с карточкой, мобильный — bottom sheet со
 * свайпом вниз для закрытия (см. useIsMobile).
 */
export default function TitlePreviewPopover({ titleId, anchorRect, onClose }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [title, setTitle] = useState<Title | null>(null)
  const [readChapterId, setReadChapterId] = useState<string | null>(null)
  const [pages, setPages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      const [fetchedTitle, chapters] = await Promise.all([getTitleById(titleId), getChapters(titleId)])
      if (cancelled) return
      setTitle(fetchedTitle ?? null)

      // chapters отсортированы по убыванию номера (см. getChapterFeed) —
      // первая читаемая глава (не внешняя ссылка) оказывается последней.
      const readable = chapters.filter((c) => !c.isExternal)
      const firstChapter = readable.length > 0 ? readable[readable.length - 1] : undefined
      setReadChapterId(firstChapter?.id ?? null)

      if (firstChapter) {
        const chapterPages = await getChapterPages(firstChapter.id)
        if (cancelled) return
        setPages(chapterPages.slice(0, PREVIEW_PAGE_COUNT))
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [titleId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const readTo = readChapterId ? `/title/${titleId}/read/${readChapterId}` : `/title/${titleId}`

  return (
    <div className={styles.backdrop} onClick={onClose}>
      {isMobile ? (
        <BottomSheet onClose={onClose}>
          <Content
            t={t}
            title={title}
            loading={loading}
            pages={pages}
            readTo={readTo}
            onClose={onClose}
          />
        </BottomSheet>
      ) : (
        <AnchoredPopup anchorRect={anchorRect}>
          <Content
            t={t}
            title={title}
            loading={loading}
            pages={pages}
            readTo={readTo}
            onClose={onClose}
          />
        </AnchoredPopup>
      )}
    </div>
  )
}

function AnchoredPopup({ anchorRect, children }: { anchorRect: DOMRect | null; children: React.ReactNode }) {
  const popupWidth = 300
  const margin = 12
  let left = anchorRect ? anchorRect.left : margin
  let top = anchorRect ? anchorRect.bottom + 8 : margin

  if (typeof window !== 'undefined') {
    left = Math.min(left, window.innerWidth - popupWidth - margin)
    left = Math.max(left, margin)
    if (anchorRect && top + 400 > window.innerHeight) {
      // не влезает снизу — открываем над карточкой
      top = Math.max(margin, anchorRect.top - 8 - 400)
    }
  }

  return (
    <div
      className={styles.popup}
      style={{ left, top, width: popupWidth }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const startY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [closing, setClosing] = useState(false)

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) setDragY(dy)
  }

  function onTouchEnd() {
    if (dragY > CLOSE_SWIPE_THRESHOLD) {
      setClosing(true)
      setTimeout(onClose, 150)
    } else {
      setDragY(0)
    }
    startY.current = null
  }

  return (
    <div
      className={styles.sheet}
      style={{
        transform: `translateY(${closing ? '100%' : `${dragY}px`})`,
        transition: dragY === 0 || closing ? 'transform 0.15s ease' : 'none',
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className={styles.dragHandle} />
      {children}
    </div>
  )
}

function Content({
  t,
  title,
  loading,
  pages,
  readTo,
  onClose,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string
  title: Title | null
  loading: boolean
  pages: string[]
  readTo: string
  onClose: () => void
}) {
  return (
    <div className={styles.content}>
      <button type="button" className={styles.closeButton} aria-label="close" onClick={onClose}>
        <X size={18} />
      </button>

      {loading || !title ? (
        <p className={styles.loading}>{t('common.loading')}</p>
      ) : (
        <>
          <div className={styles.header}>
            <CoverPlaceholder
              cover={title.cover}
              name={title.name}
              imageUrl={title.coverUrl}
              style={{ width: 56, height: 76, aspectRatio: 'auto', flexShrink: 0 }}
            />
            <div className={styles.headerInfo}>
              <p className={styles.name}>{title.name}</p>
              <span className={styles.rating}>
                <Star size={12} fill="currentColor" />
                {title.rating.toFixed(1)}
              </span>
              <div className={styles.genres}>{title.genres.slice(0, 3).join(' · ')}</div>
            </div>
          </div>

          {pages.length > 0 && (
            <div className={styles.pages}>
              {pages.map((src, i) => (
                <img key={src} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={styles.page} style={{ animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          )}

          <Link to={readTo} className={styles.readButton} onClick={onClose}>
            {t('randomFeed.readFull')}
          </Link>
        </>
      )}
    </div>
  )
}
