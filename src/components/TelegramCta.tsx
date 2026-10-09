import { Send, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TELEGRAM_URL } from '../config/links'
import { trackEvent } from '../services/analytics'
import styles from './TelegramCta.module.css'

const DISMISS_KEY = 'mangared:telegram-cta-dismissed-until'
const DISMISS_DAYS = 14

/** Откуда открыли ссылку — только для аналитики (см. trackEvent ниже). */
export type TelegramCtaPlacement = 'reader' | 'home'

interface Props {
  placement: TelegramCtaPlacement
  /** Только для placement="home" — карточку можно закрыть крестиком. */
  dismissible?: boolean
}

function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY)
    return until !== null && Date.now() < Number(until)
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — просто показываем карточку.
    return false
  }
}

/**
 * Компактная промо-карточка на Telegram-канал — два места использования:
 *  - placement="reader": экран конца главы (после кнопки "Следующая глава",
 *    перед реакциями/комментариями — см. Reader.tsx), без возможности
 *    закрыть, лента читалки и так переходит дальше.
 *  - placement="home": главная страница, с крестиком — выбор "закрыл"
 *    запоминается в localStorage на DISMISS_DAYS дней (см. isDismissed).
 *    Высота карточки фиксирована в CSS, чтобы не было сдвига макета (CLS)
 *    ни при появлении, ни при закрытии — закрытие просто убирает элемент
 *    из потока, ничего не "раздувается" на освободившееся место resize'ом
 *    соседних секций (gap в сетке секций и так одинаковый).
 */
export default function TelegramCta({ placement, dismissible }: Props) {
  const { t } = useTranslation()
  // Ленивый initializer, а не useEffect — чтобы на place="home" карточка не
  // успевала мигнуть видимой до того, как эффект прочитает localStorage
  // (это и есть лишний сдвиг макета, которого просим избежать).
  const [dismissed, setDismissed] = useState(() => (dismissible ? isDismissed() : false))

  if (dismissed) return null

  const heading = t(placement === 'reader' ? 'telegramCta.readerHeading' : 'telegramCta.homeHeading')
  const text = t(placement === 'reader' ? 'telegramCta.readerText' : 'telegramCta.homeText')

  return (
    <div className={`${styles.card} ${placement === 'home' ? styles.home : styles.reader}`}>
      <div className={styles.iconWrap}>
        <Send size={18} />
      </div>
      <div className={styles.body}>
        <p className={styles.heading}>{heading}</p>
        <p className={styles.text}>{text}</p>
      </div>
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.button}
        onClick={() => trackEvent('telegram_cta_click', { placement })}
      >
        {t('telegramCta.button')}
      </a>
      {dismissible && (
        <button
          type="button"
          className={styles.close}
          aria-label={t('telegramCta.close') ?? ''}
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000))
            } catch {
              // игнорируем — в худшем случае карточка покажется снова в следующий визит
            }
            setDismissed(true)
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
