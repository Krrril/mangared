import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ImageOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getPageFallbacks, isHomeNode } from '../api/mangadex/pageSources'
import { reportImageResult } from '../api/mangadex/imageReport'
import styles from './ImageWithRetry.module.css'

/** Полных проходов по всем адресам (основной + запасные) до показа ошибки. */
const MAX_CYCLES = 2
const BACKOFF_MS = 900

/*
  Узел, на котором в этой сессии уже не открылась глава, помним по префиксу
  "хост/папка/hash" (одна глава одного качества): остальные её страницы сразу
  идут на запасной адрес, а не ждут по очереди одного и того же отказа от
  больного узла. Запись живёт 10 минут — ровно порядок жизни baseUrl.
*/
const BAD_NODE_TTL_MS = 10 * 60_000
const badNodes = new Map<string, number>()

function nodeKey(url: string): string {
  return url.slice(0, url.lastIndexOf('/'))
}

function isBadNode(url: string): boolean {
  const at = badNodes.get(nodeKey(url))
  if (at === undefined) return false
  if (Date.now() - at > BAD_NODE_TTL_MS) {
    badNodes.delete(nodeKey(url))
    return false
  }
  return true
}

/*
  Страницы главы грузятся не все разом: ссылки ведут на один узел сети, а
  MangaDex отвечает 429 ("слишком много запросов") на всплеск десятков
  параллельных загрузок с одного IP — это тоже рвало главы целиком. Поэтому
  одновременно идёт не больше MAX_CONCURRENT страниц, остальные ждут очереди.
*/
const MAX_CONCURRENT = 5
let running = 0
const waiting: Array<() => void> = []

function acquireSlot(onGranted: (release: () => void) => void): () => void {
  const grant = () => {
    running += 1
    let released = false
    onGranted(() => {
      if (released) return
      released = true
      running -= 1
      waiting.shift()?.()
    })
  }
  if (running < MAX_CONCURRENT) {
    grant()
    return () => {}
  }
  waiting.push(grant)
  return () => {
    const i = waiting.indexOf(grant)
    if (i !== -1) waiting.splice(i, 1)
  }
}

interface Props {
  src: string
  alt: string
  /** Класс изображения (и заглушки/ошибки — они занимают то же место) */
  className?: string
  /** Запасные адреса; по умолчанию — из реестра страниц MangaDex (см. pageSources.ts) */
  fallbacks?: string[]
  /** true — грузить сразу (первые страницы главы), иначе только когда до неё докрутили */
  eager?: boolean
  /**
   * 'page' — страница читалки: при исчерпании попыток показываем ошибку с кнопкой.
   * 'cover' — обложка: после попыток рисуется fallback (градиент с буквой), без ошибки на экране.
   */
  variant?: 'page' | 'cover'
  /** Что показать вместо картинки после исчерпания попыток (для variant='cover') */
  fallback?: ReactNode
  /** Вызывается, когда все адреса и повторы исчерпаны */
  onExhausted?: () => void
}

type Status = 'loading' | 'loaded' | 'failed'
interface State {
  /** src, к которому относится состояние — при смене src состояние сбрасывается (см. ниже) */
  src: string
  index: number
  cycle: number
  status: Status
}

/**
 * Единая картинка с повторами для страниц читалки и обложек: перебирает
 * адреса (основной -> запасные), делает полные проходы с нарастающей
 * задержкой, пока идёт загрузка показывает скелетон (а не сырую "битую"
 * картинку с alt-текстом), после исчерпания попыток — понятную ошибку с
 * кнопкой "Попробовать снова". Для узлов MangaDex@Home сообщает сети
 * результат (см. imageReport.ts).
 */
export default function ImageWithRetry({ src, alt, className, fallbacks, eager = false, variant = 'page', fallback, onExhausted }: Props) {
  const { t } = useTranslation()
  const extra = fallbacks ?? getPageFallbacks(src)

  // Страницы читалки ниже экрана не запрашиваем, пока до них не докрутили
  // (свой IntersectionObserver + запасной путь по scroll/resize): порядок
  // адресов выбирается в момент начала загрузки, когда уже известно, какие
  // узлы больны, а на MangaDex@Home ещё и действует общий лимит
  // одновременных загрузок (см. acquireSlot ниже) — там держать десятки
  // загрузок про запас нельзя.
  //
  // Обложки (variant='cover') — другое дело: они с CDN/R2, без лимита на
  // одновременные запросы, а раньше здесь стоял свой такой же IO-гейт поверх
  // нативного loading="lazy" — двойная, более хрупкая логика ради того же
  // результата (на части мобильных обложки из-за этого не активировались
  // вовсе, застревая на градиенте-заглушке). Обложки тут просто eager, а
  // откладывает их загрузку сам браузер через loading="lazy" ниже — тот же
  // принцип, что и в фиксе флагов языков (не плодить свою версию того, что
  // уже надёжно делает браузер).
  const [active, setActive] = useState(eager || variant === 'cover' || typeof IntersectionObserver === 'undefined')
  const skeletonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active || !skeletonRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setActive(true)
      },
      { rootMargin: '1500px 0px' },
    )
    observer.observe(skeletonRef.current)

    // Запасной путь на случай, если IntersectionObserver не срабатывает
    // (фоновая/скрытая вкладка, встроенные браузеры): те же границы по scroll/resize.
    const el = skeletonRef.current
    function check() {
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight + 1500 && rect.bottom > -1500) setActive(true)
    }
    window.addEventListener('scroll', check, { passive: true, capture: true })
    window.addEventListener('resize', check)
    check()
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', check, { capture: true })
      window.removeEventListener('resize', check)
    }
  }, [active])

  // Если узел уже помечен больным — начинаем с запасных адресов, основной идёт последним.
  // Список фиксируется на время попыток (не пересчитывается при смене badNodes на лету).
  const sources = useMemo(
    () => (isBadNode(src) && extra.length > 0 ? [...extra, src] : [src, ...extra]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src, active, extra.join('|')],
  )

  // Состояние привязано к src и сбрасывается прямо во время рендера, а не в
  // useEffect: закэшированная картинка может успеть сработать onLoad раньше,
  // чем выполнится эффект, и сброс из эффекта затирал бы "loaded".
  const [state, setState] = useState<State>({ src, index: 0, cycle: 0, status: 'loading' })
  if (state.src !== src) setState({ src, index: 0, cycle: 0, status: 'loading' })

  const current = sources[Math.min(state.index, sources.length - 1)]
  const attemptKey = `${current}#${state.cycle}`

  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  // Слот загрузки нужен только страницам (у обложек своя ленивая загрузка браузера).
  const needsSlot = active && variant === 'page' && state.status === 'loading'
  const [granted, setGranted] = useState(false)
  const releaseRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!needsSlot) return
    let cancelled = false
    setGranted(false)
    const cancelWait = acquireSlot((release) => {
      if (cancelled) {
        release()
        return
      }
      releaseRef.current = release
      setGranted(true)
    })
    return () => {
      cancelled = true
      cancelWait()
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [needsSlot, attemptKey])

  function releaseSlot() {
    releaseRef.current?.()
    releaseRef.current = null
  }

  const startedAt = useRef(performance.now())
  useEffect(() => {
    startedAt.current = performance.now()
  }, [attemptKey, granted])

  function handleError() {
    releaseSlot()
    reportImageResult(current, false, startedAt.current)
    if (isHomeNode(current)) badNodes.set(nodeKey(current), Date.now())

    if (state.index < sources.length - 1) {
      setState((s) => ({ ...s, index: s.index + 1 }))
      return
    }
    if (state.cycle < MAX_CYCLES) {
      const delay = BACKOFF_MS * 2 ** state.cycle
      timer.current = window.setTimeout(() => setState((s) => ({ ...s, index: 0, cycle: s.cycle + 1 })), delay)
      return
    }
    setState((s) => ({ ...s, status: 'failed' }))
    onExhausted?.()
  }

  function handleLoad() {
    releaseSlot()
    reportImageResult(current, true, startedAt.current)
    setState((s) => ({ ...s, status: 'loaded' }))
  }

  if (state.status === 'failed') {
    if (variant === 'cover') return <>{fallback}</>
    return (
      <div className={`${className ?? ''} ${styles.failed}`} role="alert">
        <ImageOff size={24} aria-hidden="true" />
        <span>{t('reader.imageLoadFailed')}</span>
        <button
          type="button"
          className={styles.retryButton}
          onClick={() => {
            badNodes.delete(nodeKey(src))
            setState({ src, index: 0, cycle: 0, status: 'loading' })
          }}
        >
          {t('reader.imageRetry')}
        </button>
      </div>
    )
  }

  const loaded = state.status === 'loaded'
  const showImg = active && (variant === 'cover' || granted || loaded)
  return (
    <>
      {variant === 'page' && !loaded && <div ref={skeletonRef} className={`${className ?? ''} ${styles.skeleton}`} aria-hidden="true" />}
      {showImg && (
        <img
          key={attemptKey}
          // Та же картинка уже могла быть в кэше браузера (например, одна и
          // та же обложка показана и в карусели, и в сетке ниже) — тогда
          // .complete у свежесмонтированного <img> становится true раньше,
          // чем React успевает повесить onLoad, и событие "load" мы просто
          // не увидим: карточка навсегда остаётся на градиенте-заглушке
          // (см. .coverPending — картинка технически загружена, но
          // invisible, потому что state.status так и не стал 'loaded').
          // ref-колбэк срабатывает сразу после монтирования узла, ещё до
          // отрисовки кадра, и ловит именно этот случай.
          ref={(el) => {
            if (!el || !el.complete) return
            if (el.naturalWidth > 0) handleLoad()
            else handleError()
          }}
          src={current}
          alt={loaded ? alt : ''}
          className={loaded ? className : variant === 'cover' ? styles.coverPending : styles.probe}
          // Обложки монтируются сразу (active=true выше) и сами по себе
          // ленивые для браузера — грузятся, когда реально близко к экрану.
          // Страницы читалки, наоборот, монтируются, только когда уже
          // близко (см. IntersectionObserver выше) — раз домонтировали,
          // грузим сразу, лишний браузерный "lazy" здесь ничего не даёт.
          loading={variant === 'cover' && !eager ? 'lazy' : 'eager'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </>
  )
}
