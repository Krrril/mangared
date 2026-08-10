import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './ReaderPageImage.module.css'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 800

interface Props {
  src: string
  alt: string
  className: string
}

/**
 * MangaDex отдаёт страницы через распределённую сеть @Home — отдельные
 * узлы иногда отвечают с ошибкой или обрываются на середине, это
 * ожидаемое поведение сети, а не битая ссылка (сам MangaDex в доках API
 * рекомендует клиентам ретраить неудачные загрузки). Обычный <img> без
 * повторов на onError показывал такие страницы как навсегда сломанные —
 * отсюда и жалобы "многие главы не прогружаются".
 */
export default function ReaderPageImage({ src, alt, className }: Props) {
  const { t } = useTranslation()
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setAttempt(0)
    setFailed(false)
  }, [src])

  function handleError() {
    if (attempt < MAX_RETRIES) {
      window.setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS * (attempt + 1))
    } else {
      setFailed(true)
    }
  }

  if (failed) {
    return (
      <button
        type="button"
        className={`${className} ${styles.failed}`}
        onClick={() => {
          setAttempt(0)
          setFailed(false)
        }}
      >
        <RotateCw size={20} />
        <span>{t('reader.pageLoadFailed')}</span>
      </button>
    )
  }

  // Меняющийся query-параметр на повторных попытках — чтобы не попасть в
  // тот же самый закешированный неудачный ответ (браузер/CDN), а не
  // только для visual key.
  const attemptSrc = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`

  return (
    <img
      key={attempt}
      src={attemptSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  )
}
