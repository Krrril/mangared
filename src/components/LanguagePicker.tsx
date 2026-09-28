import { useTranslation } from 'react-i18next'
import { languageName } from '../constants/languages'
import LanguageFlag from './LanguageFlag'
import styles from './LanguagePicker.module.css'

interface Props {
  options: readonly string[]
  value: string | null
  onChange: (language: string) => void
  ariaLabel?: string
}

/** Выбор одного языка из списка с флагами (основной язык тайтла, язык новой версии главы). */
export default function LanguagePicker({ options, value, onChange, ariaLabel }: Props) {
  const { i18n } = useTranslation()
  const uiLang = i18n.resolvedLanguage ?? i18n.language
  return (
    <div className={styles.list} role="radiogroup" aria-label={ariaLabel}>
      {options.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={code === value}
          className={`${styles.option} ${code === value ? styles.optionActive : ''}`}
          onClick={() => onChange(code)}
        >
          <LanguageFlag code={code} size={20} />
          {languageName(code, uiLang)}
        </button>
      ))}
    </div>
  )
}
