import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { CURATED_GENRES } from '../constants/genres'
import styles from './GenrePicker.module.css'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
  max?: number
}

/**
 * Мультивыбор жанров из курируемого списка (см. constants/genres.ts) —
 * не свободный текст. Два способа выбрать: 1) кликнуть вариант в
 * выпадающем списке под полем, 2) напечатать начало названия и принять
 * inline-подсказку (полупрозрачный "хвост" поверх набираемого текста,
 * как автодополнение в адресной строке браузера или в терминале) клавишей
 * Tab/→/Enter — оба варианта требовались в задаче (см. сессию про
 * фидбек от Siva, "не только выпадающий список снизу").
 */
export default function GenrePicker({ value, onChange, max = 10 }: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const available = useMemo(() => CURATED_GENRES.filter((g) => !value.includes(g.slug)), [value])

  const label = (id: string) => t(`genres.${id}`)

  // Подсказка — только по совпадению НАЧАЛА названия (как в терминале/
  // адресной строке), первая по списку — иначе ghost-текст показывал бы
  // произвольное вхождение подстроки, а не буквальное продолжение набора.
  const ghostMatch = useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    return available.find((g) => label(g.id).toLowerCase().startsWith(q)) ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, available])

  // Выпадающий список — вхождение подстроки где угодно, не только с начала
  // (шире, чем ghost-подсказка), максимум 8 строк, чтобы не растягивать форму.
  const dropdownMatches = useMemo(() => {
    if (!query.trim()) return available.slice(0, 8)
    const q = query.toLowerCase()
    return available.filter((g) => label(g.id).toLowerCase().includes(q)).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, available])

  const atMax = value.length >= max

  function addGenre(slug: string) {
    if (atMax || value.includes(slug)) return
    onChange([...value, slug])
    setQuery('')
    inputRef.current?.focus()
  }

  function removeGenre(slug: string) {
    onChange(value.filter((g) => g !== slug))
  }

  function acceptGhost() {
    if (ghostMatch) addGenre(ghostMatch.slug)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'Enter') && ghostMatch) {
      e.preventDefault()
      acceptGhost()
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const ghostRemainder = ghostMatch ? label(ghostMatch.id).slice(query.length) : ''

  return (
    <div className={styles.wrap}>
      {value.length > 0 && (
        <div className={styles.chipList}>
          {value.map((slug) => {
            const genre = CURATED_GENRES.find((g) => g.slug === slug)
            return (
              <span key={slug} className={styles.chip}>
                {genre ? label(genre.id) : slug}
                <button type="button" onClick={() => removeGenre(slug)} aria-label="remove">
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {!atMax && (
        <div className={styles.inputWrap}>
          <div className={styles.ghostLayer} aria-hidden="true">
            <span className={styles.ghostTyped}>{query}</span>
            <span className={styles.ghostSuggestion}>{ghostRemainder}</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder={t('creator.new.genresPlaceholder') ?? ''}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="both"
          />
          {open && dropdownMatches.length > 0 && (
            <ul className={styles.dropdown}>
              {dropdownMatches.map((g) => (
                <li key={g.slug}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addGenre(g.slug)}>
                    {label(g.id)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
