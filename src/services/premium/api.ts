import { authorizedFetch } from '../auth/api'

export interface PremiumMe {
  isPremium: boolean
  /** Админ: Premium постоянный по роли (premiumUntil не показываем). */
  premiumPermanent?: boolean
  /** Выдан "навсегда" (дата 2099-12-31) — показывать как "навсегда", не как дату. */
  premiumForever?: boolean
  premiumUntil: string | null
  avatarFrame: string | null
  accentColor: string | null
}

export interface PremiumSelection {
  avatarFrame: string | null
  accentColor: string | null
}

export function getMyPremium(token: string): Promise<PremiumMe> {
  return authorizedFetch('/premium/me', token)
}

/** Рамка аватара и акцентный цвет — любое поле по отдельности, см. E7. */
export function customizePremium(
  token: string,
  patch: { avatarFrame?: string | null; accentColor?: string | null },
): Promise<PremiumSelection> {
  return authorizedFetch('/premium/customize', token, { method: 'PATCH', body: JSON.stringify(patch) })
}
