/*
  Варианты ответа на необязательный вопрос "Как вы о нас узнали?" в студии
  автора (см. AuthorProfile.heardFrom). Фиксированный список, а не свободный
  текст: в БД не попадает ничего персонального, а в /admin ответы
  группируются без ручной чистки. Подписи на 10 языках — в locales
  (creator.heardFrom.*), id здесь и там обязаны совпадать.
*/
export const HEARD_FROM_OPTIONS = ['search', 'tiktok', 'reddit', 'discord', 'telegram', 'friend', 'ai', 'other'] as const

export type HeardFrom = (typeof HEARD_FROM_OPTIONS)[number]
