import { useTranslation } from 'react-i18next'
import styles from './HeardFromField.module.css'

/*
  Необязательный вопрос "Как вы о нас узнали?" на форме первой публикации
  (см. AuthorProfile.heardFrom на бэкенде). Ответ — один из фиксированных
  id, свободного текста нет. Повторный клик по выбранному варианту снимает
  выбор: вопрос необязательный, "нет ответа" должно быть достижимым.
  Подписи — locales, creator.heardFrom.options.<id>.
*/

export const HEARD_FROM_OPTIONS = ['search', 'tiktok', 'reddit', 'discord', 'telegram', 'friend', 'ai', 'other'] as const

export type HeardFromOption = (typeof HEARD_FROM_OPTIONS)[number]

interface Props {
  value: HeardFromOption | null
  onChange: (value: HeardFromOption | null) => void
}

export default function HeardFromField({ value, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>
        {t('creator.heardFrom.title')} <span className={styles.optional}>{t('creator.heardFrom.optional')}</span>
      </legend>
      <div className={styles.options} role="radiogroup" aria-label={t('creator.heardFrom.title') ?? ''}>
        {HEARD_FROM_OPTIONS.map((option) => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? styles.optionActive : styles.option}
              onClick={() => onChange(selected ? null : option)}
            >
              {t(`creator.heardFrom.options.${option}`)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
