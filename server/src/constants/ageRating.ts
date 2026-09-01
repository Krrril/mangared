/*
  Возрастной рейтинг для Originals (см. задачу про фидбек от Siva).
  'unrated' — НЕ выбираемое автором значение: только служебный дефолт
  для тайтлов, опубликованных до введения этого поля (миграция
  20260901..._add_age_rating_and_curated_genres), см. UserManga.ageRating
  в schema.prisma. Именно поэтому его нет в SELECTABLE_AGE_RATINGS —
  схема создания/автор-редактирования требует один из настоящих
  рейтингов и не даёт вернуться в 'unrated' самому.
*/

export const AGE_RATINGS = ['six_plus', 'twelve_plus', 'sixteen_plus', 'eighteen_plus'] as const
export type AgeRatingValue = (typeof AGE_RATINGS)[number] | 'unrated'

export const AGE_RATING_LABELS: Record<AgeRatingValue, string> = {
  six_plus: '6+',
  twelve_plus: '12+',
  sixteen_plus: '16+',
  eighteen_plus: '18+',
  unrated: 'не указан',
}
