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

/** Поля пользователя, от которых зависит Premium. */
export interface PremiumSubject {
  isAdmin?: boolean | null
  premiumUntil?: Date | null
}

/**
 * ЕДИНСТВЕННАЯ проверка "активен ли Premium" на бэкенде — везде, где что-то
 * зависит от Premium (сохранение рамки/цвета, /api/premium/me, публичные поля
 * автора/комментатора, поле isPremium в ответах), звать только её, а не
 * сравнивать premiumUntil руками. Premium активен, если пользователь админ
 * (постоянный, по роли — в БД для админа ничего не пишем) ИЛИ premiumUntil в
 * будущем. Отозвали роль админа — Premium пропадает сам, а выбранные рамка и
 * цвет в БД остаются (как у истёкшего).
 */
export function isPremiumActive(user: PremiumSubject | null | undefined): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  return !!user.premiumUntil && user.premiumUntil.getTime() > Date.now()
}

/** Premium выдан ролью админа, а не датой — для подписи "постоянный (администратор)". */
export function isPremiumPermanent(user: PremiumSubject | null | undefined): boolean {
  return !!user?.isAdmin
}

export const PREMIUM_GRANT_DURATIONS = [7, 30, 90, 365] as const

/** "Навсегда" — условная дата в БД (колонка nullable DateTime, отдельного флага нет, миграция не нужна). */
export const PREMIUM_FOREVER_DATE = new Date('2099-12-31T23:59:59.000Z')
export function isPremiumForever(premiumUntil: Date | null | undefined): boolean {
  return !!premiumUntil && premiumUntil.getTime() >= PREMIUM_FOREVER_DATE.getTime() - 24 * 3600 * 1000
}

/** Маркер строки PremiumGrant о СНЯТИИ Premium (в таблице нет отдельного типа записи, миграции нет — помечаем префиксом заметки). */
export const PREMIUM_REVOKE_NOTE = '[revoked]'
