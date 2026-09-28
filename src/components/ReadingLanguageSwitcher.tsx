import { useTranslation } from 'react-i18next'
import { languageName, sortLanguages } from '../constants/languages'
import LanguageFlag from './LanguageFlag'
import styles from './ReadingLanguageSwitcher.module.css'

interface Props {
  languages: string[]
  value: string
  onChange: (language: string) => void
}

/**
 * Переключатель языка чтения на странице тайтла (флаг + название). Показывается,
 * только если у тайтла больше одного языка. Это язык страниц глав, не язык
 * интерфейса.
 */
export default function ReadingLanguageSwitcher({ languages, value, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const uiLang = i18n.resolvedLanguage ?? i18n.language
  const list = sortLanguages(languages)
  if (list.length < 2) return null

  return (
    <div className={styles.wrap} role="radiogroup" aria-label={t('language.reading') ?? ''}>
      <span className={styles.label}>{t('language.reading')}</span>
      {list.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={code === value}
          className={`${styles.chip} ${code === value ? styles.chipActive : ''}`}
          onClick={() => onChange(code)}
        >
          <LanguageFlag code={code} size={16} />
          {languageName(code, uiLang)}
        </button>
      ))}
    </div>
  )
}
