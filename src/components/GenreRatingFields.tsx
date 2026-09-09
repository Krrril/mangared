import { useTranslation } from 'react-i18next'
import GenrePicker from './GenrePicker'
import { AGE_RATINGS, type SelectableAgeRating } from '../constants/ageRating'
import styles from './GenreRatingFields.module.css'

interface Props {
  genres: string[]
  onGenresChange: (next: string[]) => void
  ageRating: SelectableAgeRating | null
  onAgeRatingChange: (next: SelectableAgeRating) => void
}

/**
 * Жанры (курируемый список, см. GenrePicker) + возрастной рейтинг — общий
 * блок формы, раньше был скопирован по отдельности в NewManga.tsx (создание),
 * MangaDetail.tsx (правка автором) и OriginalDetail.tsx (правка админом), из-за
 * чего они разъехались: правка в студии автора для уже опубликованных
 * тайтлов молча не показывала эти поля вовсе (см. баг-репорт Siva). Один
 * компонент на все три места — значит один источник правды на будущее.
 */
export default function GenreRatingFields({ genres, onGenresChange, ageRating, onAgeRatingChange }: Props) {
  const { t } = useTranslation()

  return (
    <>
      <label className={styles.label}>{t('creator.new.genresLabel')}</label>
      <GenrePicker value={genres} onChange={onGenresChange} />

      <label className={styles.label}>{t('creator.new.ageRatingLabel')}</label>
      <div className={styles.segmented}>
        {AGE_RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            className={ageRating === r ? styles.segmentActive : styles.segment}
            onClick={() => onAgeRatingChange(r)}
          >
            {t(`ageRating.${r}`)}
          </button>
        ))}
      </div>
    </>
  )
}
