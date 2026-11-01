import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  backoffDelay,
  coverSources,
  enqueueCover,
  isCoverBreakerOpen,
  noteCoverFailure,
  noteCoverSuccess,
  probeCover,
  releaseCover,
  resetCoverBreaker,
} from '../api/mangadex/coverQueue'
import styles from './CoverImage.module.css'

/*
  Обложка тайтла. Рисуется ВНУТРИ позиционированного контейнера (см.
  CoverPlaceholder): под ней всегда виден градиент с буквой.

  Загрузка: очередь (не больше 6 одновременно, ближние к экрану — первыми,
  см. coverQueue.ts) → запасные размеры (.256 → .512 → оригинал) → повторы с
  растущей паузой (1.5 с, 4 с) и учётом Retry-After (читается одним запросом
  после первой неудачи). Если MangaDex отвечает 403 (проверка "Bot challenge
  not passed" на запросы с чужих сайтов) — перебирать размеры бессмысленно:
  сразу показываем кнопку "Повторить" и не долбим CDN дальше. После
  исчерпания попыток — иконка и "Повторить" по тапу вместо вечной заглушки.

  Устроено как маленький автомат на эффекте + refs, без setState во время
  рендера и без inline ref-колбэков (см. инцидент с ImageWithRetry в git log).
*/

const MAX_CYCLES = 2 // полных проходов по размерам после первого

type Status = 'queued' | 'loading' | 'loaded' | 'failed'

interface Props {
  src: string
  alt: string
  /** Класс загруженной картинки (position:absolute; inset:0 …) */
  className?: string
}

export default function CoverImage({ src, alt, className }: Props) {
  const { t } = useTranslation()
  const sources = useMemo(() => coverSources(src), [src])
  const anchorRef = useRef<HTMLSpanElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [status, setStatus] = useState<Status>('queued')
  const [current, setCurrent] = useState(sources[0])
  const [attempt, setAttempt] = useState(0)
  const [nonce, setNonce] = useState(0)
  // Результат попытки сообщает <img> (onLoad/onError) — автомат подписывается сюда.
  const resultRef = useRef<((ok: boolean, attemptId: number) => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null
    let cancelQueue: (() => void) | null = null
    let holdingSlot = false
    const chain = { size: 0, cycle: 0, probed: false, retryAfterMs: undefined as number | undefined }
    const manual = nonce > 0
    // Результат одной попытки учитываем один раз: onLoad/onError и проверка complete могут сработать оба.
    let handledAttempt = -1

    setStatus('queued')
    setCurrent(sources[0])

    const release = () => {
      if (holdingSlot) {
        holdingSlot = false
        releaseCover()
      }
    }

    const fail = () => {
      release()
      if (cancelled) return
      noteCoverFailure()
      setStatus('failed')
    }

    const queueAttempt = () => {
      if (cancelled) return
      if (!manual && isCoverBreakerOpen()) {
        // CDN сейчас массово отказывает — не ходим в сеть, ждём паузы или тапа "Повторить".
        fail()
        return
      }
      cancelQueue = enqueueCover(anchorRef.current, () => {
        if (cancelled) {
          releaseCover()
          return
        }
        holdingSlot = true
        // Пока ждали слот, предохранитель мог сработать — тогда в сеть не идём.
        if (!manual && isCoverBreakerOpen()) {
          fail()
          return
        }
        setCurrent(sources[chain.size])
        setAttempt((n) => n + 1)
        setStatus('loading')
      })
    }

    const scheduleNext = (delayMs: number) => {
      release()
      if (cancelled) return
      timer = window.setTimeout(queueAttempt, delayMs)
    }

    const advance = () => {
      // Следующий размер сразу; новый проход — после паузы.
      if (chain.size < sources.length - 1) {
        chain.size += 1
        // Retry-After (429) действует и на смену размера: сервер просил подождать.
        const wait = Math.max(250, chain.retryAfterMs ?? 0)
        chain.retryAfterMs = undefined
        scheduleNext(wait)
      } else if (chain.cycle < MAX_CYCLES) {
        const delay = backoffDelay(chain.cycle, chain.retryAfterMs)
        chain.cycle += 1
        chain.size = 0
        chain.retryAfterMs = undefined
        scheduleNext(delay)
      } else {
        fail()
      }
    }

    resultRef.current = (ok, attemptId) => {
      if (cancelled || attemptId === handledAttempt) return
      handledAttempt = attemptId
      if (ok) {
        release()
        noteCoverSuccess()
        setStatus('loaded')
        return
      }
      if (chain.probed) {
        advance()
        return
      }
      // Первая неудача: один запрос, чтобы узнать причину (403 / 429 + Retry-After).
      chain.probed = true
      void probeCover(sources[chain.size]).then((probe) => {
        if (cancelled) return
        if (probe.kind === 'blocked') {
          fail()
          return
        }
        if (probe.kind === 'rateLimited') chain.retryAfterMs = probe.retryAfterMs
        advance()
      })
    }

    queueAttempt()

    return () => {
      cancelled = true
      resultRef.current = null
      if (timer !== null) window.clearTimeout(timer)
      cancelQueue?.()
      release()
    }
  }, [sources, nonce])

  // Уже закэшированная картинка может стать complete раньше, чем сработает onLoad.
  useEffect(() => {
    const el = imgRef.current
    if (!el || !el.complete) return
    resultRef.current?.(el.naturalWidth > 0, attempt)
  }, [attempt])

  const loaded = status === 'loaded'
  return (
    <>
      <span ref={anchorRef} className={styles.anchor} aria-hidden="true" />
      {(status === 'loading' || loaded) && (
        <img
          key={attempt}
          ref={imgRef}
          src={current}
          alt={loaded ? alt : ''}
          className={loaded ? className : styles.pending}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => resultRef.current?.(true, attempt)}
          onError={() => resultRef.current?.(false, attempt)}
        />
      )}
      {status === 'failed' && (
        <button
          type="button"
          className={styles.retry}
          aria-label={t('covers.retryAria', { title: alt }) ?? ''}
          onClick={(e) => {
            // Обложка обычно лежит внутри ссылки на тайтл — тап по "Повторить" не должен её открывать.
            e.preventDefault()
            e.stopPropagation()
            resetCoverBreaker()
            setNonce((n) => n + 1)
          }}
        >
          <RotateCw size={16} aria-hidden="true" />
          <span>{t('covers.retry')}</span>
        </button>
      )}
    </>
  )
}
