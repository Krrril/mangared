import { useEffect, useRef, useState } from 'react'
import { Dices, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Title } from '../services/content/types'
import { getWeightedRandomTitles, hideTitleTemporarily } from '../utils/randomFeed'
import { useIsMobile } from '../hooks/useIsMobile'
import CoverPlaceholder from './CoverPlaceholder'
import TitlePreviewPopover from './TitlePreviewPopover'
import styles from './RandomFeed.module.css'

const MARQUEE_SIZE = 16
const GRID_SIZE = 10
const TOUCH_RESUME_DELAY_MS = 2000
const HIDE_SWIPE_THRESHOLD = 60

interface PreviewState {
  titleId: string
  anchorRect: DOMRect | null
}

/**
 * "Умная случайная лента" на главной — тихий фоновый marquee из тайтлов,
 * подобранных с учётом истории чтения (см. src/utils/randomFeed.ts), плюс
 * кнопка-кубик, раскрывающая сетку из 10 тайтлов. Один компонент для
 * десктопа и мобильного — разница только в CSS Modules (media query) и в
 * том, что открывает клик по обложке (TitlePreviewPopover сам решает,
 * попап это или bottom sheet).
 */
export default function RandomFeed() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [marqueeTitles, setMarqueeTitles] = useState<Title[]>([])
  const [gridTitles, setGridTitles] = useState<Title[]>([])
  const [gridOpen, setGridOpen] = useState(false)
  const [gridLoading, setGridLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [paused, setPaused] = useState(false)
  const resumeTimer = useRef<number | null>(null)

  useEffect(() => {
    getWeightedRandomTitles(MARQUEE_SIZE).then(setMarqueeTitles)
  }, [])

  useEffect(() => {
    return () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current)
    }
  }, [])

  function handleHideFromMarquee(titleId: string) {
    hideTitleTemporarily(titleId)
    setMarqueeTitles((prev) => prev.filter((title) => title.id !== titleId))
  }

  function handleHideFromGrid(titleId: string) {
    hideTitleTemporarily(titleId)
    setGridTitles((prev) => prev.filter((title) => title.id !== titleId))
    setMarqueeTitles((prev) => prev.filter((title) => title.id !== titleId))
  }

  async function rollDice() {
    setGridOpen(true)
    setGridLoading(true)
    const titles = await getWeightedRandomTitles(GRID_SIZE)
    setGridTitles(titles)
    setGridLoading(false)
  }

  function openPreview(title: Title, rect: DOMRect) {
    setPreview({ titleId: title.id, anchorRect: rect })
  }

  function pauseMarquee() {
    if (resumeTimer.current) {
      window.clearTimeout(resumeTimer.current)
      resumeTimer.current = null
    }
    setPaused(true)
  }

  function scheduleResumeMarquee() {
    resumeTimer.current = window.setTimeout(() => setPaused(false), TOUCH_RESUME_DELAY_MS)
  }

  // Пока каталог/история ещё грузятся (или подходящих тайтлов не нашлось) —
  // не занимаем место на главной пустой секцией.
  if (marqueeTitles.length === 0) return null

  const loopTitles = [...marqueeTitles, ...marqueeTitles]

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('randomFeed.title')}</h2>
        <p className={styles.subtitle}>{t('randomFeed.subtitle')}</p>
      </div>

      <div
        className={styles.marqueeViewport}
        onMouseEnter={pauseMarquee}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={pauseMarquee}
        onTouchEnd={scheduleResumeMarquee}
      >
        <div className={styles.marqueeTrack} style={{ animationPlayState: paused ? 'paused' : 'running' }}>
          {loopTitles.map((title, i) => (
            <FeedCard
              key={`${title.id}-${i}`}
              title={title}
              isMobile={isMobile}
              onOpenPreview={openPreview}
              onHide={handleHideFromMarquee}
            />
          ))}
        </div>
      </div>

      <button type="button" className={styles.diceButton} onClick={rollDice}>
        <Dices size={18} />
        {t('randomFeed.rollDice')}
      </button>

      {gridOpen && (
        <div className={styles.grid}>
          {gridLoading
            ? Array.from({ length: GRID_SIZE }).map((_, i) => <div key={i} className={styles.skeleton} />)
            : gridTitles.map((title) => (
                <FeedCard
                  key={title.id}
                  title={title}
                  isMobile={isMobile}
                  onOpenPreview={openPreview}
                  onHide={handleHideFromGrid}
                />
              ))}
        </div>
      )}

      {preview && (
        <TitlePreviewPopover
          titleId={preview.titleId}
          anchorRect={isMobile ? null : preview.anchorRect}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  )
}

function FeedCard({
  title,
  isMobile,
  onOpenPreview,
  onHide,
}: {
  title: Title
  isMobile: boolean
  onOpenPreview: (title: Title, rect: DOMRect) => void
  onHide: (titleId: string) => void
}) {
  const { t } = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  const startX = useRef<number | null>(null)
  const [dragX, setDragX] = useState(0)
  const [removing, setRemoving] = useState(false)

  function commitHide() {
    setRemoving(true)
    window.setTimeout(() => onHide(title.id), 180)
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return
    const dx = e.touches[0].clientX - startX.current
    if (dx < 0) setDragX(dx)
  }

  function onTouchEnd() {
    if (dragX < -HIDE_SWIPE_THRESHOLD) {
      commitHide()
    } else {
      setDragX(0)
    }
    startX.current = null
  }

  function handleOpen() {
    if (Math.abs(dragX) > 5) return // это был свайп, а не тап — не открывать превью
    if (cardRef.current) onOpenPreview(title, cardRef.current.getBoundingClientRect())
  }

  return (
    <div
      ref={cardRef}
      className={styles.card}
      style={{
        transform: removing ? 'translateX(-100%)' : `translateX(${dragX}px)`,
        opacity: removing ? 0 : 1 - Math.min(Math.abs(dragX) / 150, 0.6),
        transition: dragX === 0 || removing ? 'transform 0.18s ease, opacity 0.18s ease' : 'none',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button type="button" className={styles.cardHit} onClick={handleOpen}>
        <CoverPlaceholder cover={title.cover} name={title.name} imageUrl={title.coverUrl} className={styles.cover} />
        <p className={styles.cardName}>{title.name}</p>
        <p className={styles.cardChapter}>{t('common.chapter', { number: title.chaptersCount })}</p>
      </button>

      {!isMobile && (
        <button
          type="button"
          className={styles.hideButton}
          aria-label={t('randomFeed.hide')}
          onClick={(e) => {
            e.stopPropagation()
            commitHide()
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
