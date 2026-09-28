import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { languageName, sortLanguages } from '../constants/languages'
import LanguageFlag from './LanguageFlag'
import styles from './LanguageBadge.module.css'

interface Props {
  /** Коды языков (наши 10 или сырые коды MangaDex) */
  languages: string[]
  /** Язык, флаг которого показываем, если он есть в списке (для MangaDex — язык интерфейса) */
  preferred?: string
  /** Основной язык тайтла (Originals): показывается флагом и стоит первым в списке. Без него первым идёт английский. */
  primary?: string
  /** Выбор языка из поповера. Без него бейдж всегда статичный, даже при 2+ языках. */
  onSelect?: (language: string) => void
  /** true (по умолчанию) — абсолютно позиционируется в правом нижнем углу ближайшего relative-родителя (обложки) */
  overlay?: boolean
  className?: string
}

/**
 * Флаг языка чтения на карточке/обложке. Один язык — статичный флаг без
 * клика. Два и больше — флаг основного языка + "+N", клик/тап открывает
 * компактный поповер со списком языков. Клик по бейджу не запускает
 * переход по самой карточке (карточка — <Link>), при этом кнопка
 * достижима с клавиатуры.
 */
export default function LanguageBadge({ languages, preferred, primary, onSelect, overlay = true, className }: Props) {
  const { t, i18n } = useTranslation()
  const uiLang = i18n.resolvedLanguage ?? i18n.language
  const sorted = sortLanguages(languages)
  const list = primary && sorted.includes(primary) ? [primary, ...sorted.filter((l) => l !== primary)] : sorted
  const shown = preferred && list.includes(preferred) ? preferred : list[0]
  const extra = list.length - 1

  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const width = 190
    const height = Math.min(list.length * 40 + 12, 280)
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))
    const above = rect.top - height - 6 >= 8
    setPos({ left, top: above ? rect.top - height - 6 : Math.min(window.innerHeight - height - 8, rect.bottom + 6) })
  }, [open, list.length])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    popoverRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (list.length === 0 || !shown) return null

  const wrapperClass = `${overlay ? styles.overlay : ''} ${className ?? ''}`
  const shownName = languageName(shown, uiLang)
  // У тайтлов MangaDex языков бывает 30+ — в подсказке/aria-label перечисляем первые восемь.
  const namesLabel = list.slice(0, 8).map((c) => languageName(c, uiLang)).join(', ') + (list.length > 8 ? '…' : '')

  // Один язык (или выбор не подключён) — статичный флаг.
  if (extra === 0 || !onSelect) {
    const label = extra === 0 ? `${t('language.reading')}: ${shownName}` : `${t('language.available')}: ${namesLabel}`
    return (
      <span className={`${wrapperClass} ${styles.badge}`} role="img" aria-label={label} title={label}>
        <LanguageFlag code={shown} size={18} />
        {extra > 0 && <span className={styles.more}>+{extra}</span>}
      </span>
    )
  }

  const label = `${t('language.available')}: ${namesLabel}`
  return (
    <span className={wrapperClass}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.badge} ${styles.trigger}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <LanguageFlag code={shown} size={18} />
        <span className={styles.more}>+{extra}</span>
      </button>
      {open &&
        pos &&
        createPortal(
          <ul ref={popoverRef} className={styles.popover} style={{ top: pos.top, left: pos.left }} role="menu" aria-label={t('language.reading') ?? ''}>
            {list.map((code) => (
              <li key={code} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`${styles.item} ${code === shown ? styles.itemActive : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setOpen(false)
                    onSelect(code)
                  }}
                >
                  <LanguageFlag code={code} size={20} />
                  <span>{languageName(code, uiLang)}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </span>
  )
}
