/*
  MangaGreen Premium, этап 1 (косметика: корона + рамка аватара + акцентный
  цвет ника, без оплаты). Идентификаторы здесь только для ВАЛИДАЦИИ на
  бэкенде (см. routes/premium.ts) — сама графика рамок на фронтенде
  (src/constants/premium.tsx), бэкенд её не рендерит и не знает про SVG.

  ВАЖНО (юридическое ограничение): Premium не влияет на каталог MangaDex —
  все привилегии только вокруг профиля и комментариев.
*/

export const PREMIUM_FRAMES = ['sakura', 'cosmos', 'kitsune', 'wanderer'] as const
export type PremiumFrame = (typeof PREMIUM_FRAMES)[number]

/** Один акцентный цвет-пресет на рамку (см. задачу E6). */
export const PREMIUM_ACCENT_COLORS: Record<PremiumFrame, string> = {
  sakura: '#f472b6',
  cosmos: '#a78bfa',
  kitsune: '#fb923c',
  wanderer: '#ca8a04',
}

export function isPremiumFrame(v: unknown): v is PremiumFrame {
  return typeof v === 'string' && (PREMIUM_FRAMES as readonly string[]).includes(v)
}
export function isPremiumAccentColor(v: unknown): boolean {
  return typeof v === 'string' && Object.values(PREMIUM_ACCENT_COLORS).includes(v)
}

/** Premium активен, если премиум-дата задана и в будущем. */
export function isPremiumActive(premiumUntil: Date | null): boolean {
  return !!premiumUntil && premiumUntil.getTime() > Date.now()
}

export const PREMIUM_GRANT_DURATIONS = [7, 30, 90, 365] as const
