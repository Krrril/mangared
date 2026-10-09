import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { languageName, sortLanguages } from '../constants/languages'
import { useIsMobile } from '../hooks/useIsMobile'
import LanguageFlag from './LanguageFlag'
import styles from './LanguageBadge.module.css'

/** Больше этого числа языков — в поповере/шторке появляется поиск. */
const SEARCH_THRESHOLD = 9

interface Props {
  /** Коды языков (наши 10 или сырые коды MangaDex) */
  languages: string[]
  /** Язык, флаг которого показываем, если он есть в списке (для MangaDex — язык интерфейса) */
  preferred?: string
  /** Основной язык тайтла (Originals): показывается флагом и стоит первым в списке. Без него первым идёт английский. */
  primary?: string
  /** Выбор языка из поповера. Без него бейдж всегда статичный, даже при 2+ языках. */
  onSelect?: (language: string) => void
  /**
   * 'compact' (по умолчанию) — маленький флаг+"+N", без названия языка.
   * 'block' — крупный элемент флаг+название+"+N" в потоке разметки (блок
   * "Язык чтения" на странице тайтла).
   */
  variant?: 'compact' | 'block'
  /**
   * true (по умолчанию) — абсолютно позиционируется в правом нижнем углу
   * ближайшего relative-родителя (обложка карточки). false — обычный
   * элемент в потоке (карточка каталога, где бейдж уже стоит в своём
   * flex-ряду). Независим от variant.
   */
  overlay?: boolean
  /** Число глав на каждый язык — показывается в списке рядом с названием (страница тайтла). */
  chapterCounts?: Record<string, number>
  /**
   * Точный список "рабочих" языков (только те, где реально открывается
   * глава — см. server/src/services/mangadexLanguages.ts), приходит
   * позже и заменяет собой `languages`/`chapterCounts` (которые до этого —
   * лишь быстрая подсказка по availableTranslatedLanguages, без проверки
   * открываемости). На варианте 'inline' запрашивается сразу, на 'overlay'
   * (карточки) — лениво, при первом открытии списка, чтобы не бить по
   * лимитам MangaDex проверкой каждой карточки в сетке.
   */
  refine?: () => Promise<{ code: string; chapters: number }[]>
  className?: string
}

/**
 * Единый выбор языка чтения — для флага на обложке карточки (variant=
 * 'overlay') и для блока "Язык чтения" на странице тайтла (variant='inline'),
 * у MangaDex и у Originals. Один язык — статичный флаг, клик не открывает
 * список. Два и больше — открывается список (на мобильных — нижняя шторка
 * с поиском при 9+ языках), выбор вызывает onSelect. Клик по бейджу не
 * запускает переход по карточке (stopPropagation), доступен с клавиатуры.
 */
export default function LanguageBadge({ languages, preferred, primary, onSelect, variant = 'compact', overlay = true, chapterCounts, refine, className }: Props) {
  const { t, i18n } = useTranslation()
  const isMobile = useIsMobile()
  const uiLang = i18n.resolvedLanguage ?? i18n.language

  const [refined, setRefined] = useState<{ code: string; chapters: number }[] | null>(null)
  const requestedRefine = useRef(false)
  function ensureRefined() {
    if (!refine || requestedRefine.current) return
    requestedRefine.current = true
    refine()
      .then((res) => setRefined(res))
      .catch(() => {})
  }
  // На странице тайтла (block) языков одного тайтла — запрашиваем сразу,
  // это одна проверка на всю страницу, не N на сетку карточек.
  useEffect(() => {
    if (variant === 'block') ensureRefined()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant])

  const effectiveLanguages = refined ? refined.map((r) => r.code) : languages
  const effectiveCounts = refined ? Object.fromEntries(refined.map((r) => [r.code, r.chapters])) : chapterCounts

  const sorted = sortLanguages(effectiveLanguages)
  const list = primary && sorted.includes(primary) ? [primary, ...sorted.filter((l) => l !== primary)] : sorted
  const shown = preferred && list.includes(preferred) ? preferred : list[0]
  const extra = list.length - 1

  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [query, setQuery] = useState('')

  const showSearch = list.length >= SEARCH_THRESHOLD
  const filtered = useMemo(() => {
    if (!showSearch || !query.trim()) return list
    const q = query.trim().toLowerCase()
    return list.filter((c) => languageName(c, uiLang).toLowerCase().includes(q) || c.toLowerCase().includes(q))
  }, [list, query, showSearch, uiLang])

  useLayoutEffect(() => {
    if (!open || isMobile || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const width = 220
    const height = Math.min(list.length * 40 + (showSearch ? 52 : 0) + 12, 320)
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))
    const above = rect.top - height - 6 >= 8
    setPos({ left, top: above ? rect.top - height - 6 : Math.min(window.innerHeight - height - 8, rect.bottom + 6) })
  }, [open, isMobile, list.length, showSearch])

  // Пока открыта мобильная шторка, блокируем скролл body — иначе тач мимо
  // списка (или инерция momentum-скролла) двигает страницу под ней,
  // получается двойная прокрутка и дёрганье. overflow:hidden одного body
  // на iOS Safari ненадёжен (фон всё равно можно "оттянуть" резиновым
  // скроллом) — фиксируем body на месте через position:fixed с сохранённым
  // отступом и возвращаем прокрутку на то же место при закрытии.
  useEffect(() => {
    if (!open || !isMobile) return
    const scrollY = window.scrollY
    const { style } = document.body
    const prev = { position: style.position, top: style.top, left: style.left, right: style.right, width: style.width, overflow: style.overflow }
    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.left = '0'
    style.right = '0'
    style.width = '100%'
    style.overflow = 'hidden'
    return () => {
      style.position = prev.position
      style.top = prev.top
      style.left = prev.left
      style.right = prev.right
      style.width = prev.width
      style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [open, isMobile])

  useEffect(() => {
    if (!open) return
    setQuery('')
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
    // Скролл СТРАНИЦЫ закрывает десктопный поповер (он position:fixed и иначе
    // остался бы висеть на месте, пока триггер уехал). Но слушатель стоит в фазе
    // capture на window и ловит scroll любого элемента — в том числе самого
    // списка языков внутри поповера: без этой проверки первый же тик колеса по
    // списку закрывал поповер, а остаток прокрутки уходил в страницу под ним.
    const onScroll = (e: Event) => {
      if (popoverRef.current?.contains(e.target as Node)) return
      close()
    }
    if (!isMobile) {
      window.addEventListener('scroll', onScroll, true)
      window.addEventListener('resize', close)
    }
    // Автофокус — только на десктопе (поповер): фокус в поиск (если есть),
    // иначе на первый пункт списка — ожидаемое поведение для управления с
    // клавиатуры. На мобильной шторке автофокус на поле поиска сразу же
    // поднимает экранную клавиатуру и меняет видимую высоту вьюпорта
    // (dvh пересчитывается), из-за чего только что открывшаяся шторка
    // дёргается/подпрыгивает — пользователь открывает список глазами, а
    // не клавиатурой, поэтому на тач-устройствах просто не фокусируем ничего.
    if (!isMobile) {
      ;(showSearch ? searchRef.current : popoverRef.current?.querySelector<HTMLButtonElement>('button'))?.focus()
    }
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, isMobile, showSearch])

  if (list.length === 0 || !shown) return null

  const shownName = languageName(shown, uiLang)
  // У тайтлов MangaDex языков бывает 30+ — в подсказке/aria-label перечисляем первые восемь.
  const namesLabel = list.slice(0, 8).map((c) => languageName(c, uiLang)).join(', ') + (list.length > 8 ? '…' : '')
  const listLabel = t('language.reading') ?? ''

  function renderList() {
    return (
      <>
        {showSearch && (
          <div className={styles.searchRow}>
            <Search size={14} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('language.searchPlaceholder') ?? ''}
              aria-label={t('language.searchPlaceholder') ?? ''}
            />
          </div>
        )}
        <ul className={styles.list} role="menu" aria-label={listLabel}>
          {filtered.length === 0 && <li className={styles.empty}>{t('language.noMatch')}</li>}
          {filtered.map((code) => (
            <li key={code} role="none">
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${code === shown ? styles.itemActive : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setOpen(false)
                  onSelect?.(code)
                }}
              >
                <LanguageFlag code={code} size={20} />
                <span className={styles.itemName}>{languageName(code, uiLang)}</span>
                {effectiveCounts?.[code] !== undefined && (
                  <span className={styles.itemCount}>{t('common.chapter', { number: effectiveCounts[code] })}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </>
    )
  }

  const trigger =
    variant === 'block' ? (
      <>
        <LanguageFlag code={shown} size={20} />
        <span className={styles.inlineName}>{shownName}</span>
        {extra > 0 && <span className={styles.more}>+{extra}</span>}
      </>
    ) : (
      <>
        <LanguageFlag code={shown} size={18} />
        {extra > 0 && <span className={styles.more}>+{extra}</span>}
      </>
    )

  const rootClass = `${overlay ? styles.overlay : ''} ${className ?? ''}`

  // Один язык (или выбор не подключён) — статичный флаг/блок, без клика.
  if (extra === 0 || !onSelect) {
    const label = extra === 0 ? `${t('language.reading')}: ${shownName}` : `${t('language.available')}: ${namesLabel}`
    return (
      <span className={`${rootClass} ${styles.badge} ${variant === 'block' ? styles.badgeInline : ''}`} role="img" aria-label={label} title={label}>
        {trigger}
      </span>
    )
  }

  const label = `${t('language.available')}: ${namesLabel}`
  return (
    <span className={rootClass}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.badge} ${styles.trigger} ${variant === 'block' ? styles.badgeInline : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          ensureRefined()
          setOpen((v) => !v)
        }}
      >
        {trigger}
        {/* Шеврон — только у кликабельного block-варианта (страница тайтла):
            визуально показывает, что это раскрывающийся список, а не просто
            подпись языка. У компактного overlay-флага на обложке карточки
            его нет — там мало места и действие и так ясно по тапу. */}
        {variant === 'block' && <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />}
      </button>
      {open &&
        (isMobile
          ? createPortal(
              <div className={styles.sheetBackdrop} onClick={() => setOpen(false)}>
                <div
                  ref={popoverRef}
                  className={styles.sheet}
                  role="dialog"
                  aria-modal="true"
                  aria-label={listLabel}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={styles.sheetHandle} aria-hidden="true" />
                  {renderList()}
                </div>
              </div>,
              document.body,
            )
          : pos &&
            createPortal(
              <div ref={popoverRef} className={styles.popover} style={{ top: pos.top, left: pos.left }}>
                {renderList()}
              </div>,
              document.body,
            ))}
    </span>
  )
}
