/*
  Возрастной рейтинг Originals — зеркало server/src/constants/ageRating.ts.
  'unrated' — служебное значение только для тайтлов, опубликованных до
  введения этого поля (см. миграцию add_age_rating_and_curated_genres) —
  не предлагается автору как вариант выбора ни при создании, ни в правке.
*/

export const AGE_RATINGS = ['six_plus', 'twelve_plus', 'sixteen_plus', 'eighteen_plus'] as const
export type SelectableAgeRating = (typeof AGE_RATINGS)[number]
export type AgeRating = SelectableAgeRating | 'unrated'

/** Дефолтные (нелокализованные) подписи — компоненты предпочитают t('ageRating.<value>'), см. locales/*.json; это только фолбэк. */
export const AGE_RATING_LABELS: Record<AgeRating, string> = {
  six_plus: '6+',
  twelve_plus: '12+',
  sixteen_plus: '16+',
  eighteen_plus: '18+',
  unrated: 'Not rated',
}
