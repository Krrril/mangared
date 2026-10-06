/*
  MangaGreen Premium, этап 1 (косметика). Три независимых реестра —
  рамка аватара, фон профиля, связка (рамка+фон+акцент) — идентификаторы
  здесь только для ВАЛИДАЦИИ на бэкенде (см. updateAvatarFrame и т.п. в
  routes/premium.ts); сама графика — на фронтенде (src/constants/premium.tsx),
  бэкенд её не рендерит и не знает про SVG.

  ВАЖНО (юридическое ограничение): Premium не влияет на каталог MangaDex —
  все привилегии только вокруг профиля, комментариев и своего контента.
*/

export const PREMIUM_FRAMES = [
  'sakura',
  'cosmos',
  'kitsune',
  'wanderer',
  'sunset',
  'mangagreen',
  'heaven',
  'flame',
  'cozy',
  'ball',
] as const
export type PremiumFrame = (typeof PREMIUM_FRAMES)[number]

export const PREMIUM_BACKGROUNDS = [...PREMIUM_FRAMES] as const
export type PremiumBackground = (typeof PREMIUM_BACKGROUNDS)[number]

// Связка = рамка + фон + акцент одним нажатием (пользователь потом может
// сменить рамку/фон/цвет по отдельности, см. E7) — id связки совпадает с id
// её "родных" рамки/фона, отдельного реестра id для связок не нужно.
export const PREMIUM_BUNDLES = [...PREMIUM_FRAMES] as const
export type PremiumBundle = (typeof PREMIUM_BUNDLES)[number]

export const PREMIUM_ACCENT_COLORS: Record<PremiumBundle, string> = {
  sakura: '#f472b6',
  cosmos: '#a78bfa',
  kitsune: '#fb923c',
  wanderer: '#ca8a04',
  sunset: '#b91c1c',
  mangagreen: '#4caf7d',
  heaven: '#38bdf8',
  flame: '#ef4444',
  cozy: '#f59e0b',
  ball: '#eab308',
}

export function isPremiumFrame(v: unknown): v is PremiumFrame {
  return typeof v === 'string' && (PREMIUM_FRAMES as readonly string[]).includes(v)
}
export function isPremiumBackground(v: unknown): v is PremiumBackground {
  return typeof v === 'string' && (PREMIUM_BACKGROUNDS as readonly string[]).includes(v)
}
export function isPremiumBundle(v: unknown): v is PremiumBundle {
  return typeof v === 'string' && (PREMIUM_BUNDLES as readonly string[]).includes(v)
}
export function isPremiumAccentColor(v: unknown): boolean {
  return typeof v === 'string' && Object.values(PREMIUM_ACCENT_COLORS).includes(v)
}

/** Premium активен, если премиум-дата задана и в будущем. */
export function isPremiumActive(premiumUntil: Date | null): boolean {
  return !!premiumUntil && premiumUntil.getTime() > Date.now()
}

export const PREMIUM_GRANT_DURATIONS = [7, 30, 90, 365] as const

/*
  Стикеры-реакции под комментарием (см. E5, CommentReaction в schema.prisma).
  Ставить может только Premium, видят и считают — все. Значения совпадают
  с enum CommentStickerType в schema.prisma.
*/
export const PREMIUM_STICKER_TYPES = [
  'fire',
  'sparkle',
  'heart',
  'cry',
  'laugh',
  'star',
  'paw',
  'book',
  'heart_eyes',
  'shock',
] as const
export type PremiumStickerType = (typeof PREMIUM_STICKER_TYPES)[number]

export function isPremiumStickerType(v: unknown): v is PremiumStickerType {
  return typeof v === 'string' && (PREMIUM_STICKER_TYPES as readonly string[]).includes(v)
}
