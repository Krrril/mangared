// Базовая фильтрация мата/спама на уровне текста комментариев (см.
// задачу — "простой словарь стоп-слов", без модерации перед публикацией,
// значит эта проверка — единственный автоматический барьер). Не
// претендует на полноту (обходится транслитом/пробелами) — это осознанно
// не ML-решение, просто первый барьер, реальная модерация — через
// "Пожаловаться" (см. routes/comments.ts, POST /:id/report).
const BLOCKED_SUBSTRINGS = [
  // Русский мат — основные корни, без словоформ (ищем по вхождению подстроки).
  'хуй',
  'хуе',
  'хуи',
  'пизд',
  'ебат',
  'ёбан',
  'еблан',
  'ебал',
  'ебуч',
  'бляд',
  'сука бл',
  'мудак',
  'мудил',
  'долбоёб',
  'долбоеб',
  'пидор',
  'пидар',
  'залуп',
  'гандон',
  'ссук',
  // English profanity — common roots, catches most inflections via substring match.
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'dickhead',
  'motherfuck',
  'whore',
  'slut',
  'nigger',
  'faggot',
]

/** Простая проверка по вхождению подстроки, регистронезависимо — см. комментарий у BLOCKED_SUBSTRINGS выше. */
export function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase()
  return BLOCKED_SUBSTRINGS.some((word) => normalized.includes(word))
}
