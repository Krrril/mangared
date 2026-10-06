import { authorizedFetch } from '../auth/api'

export interface PremiumMe {
  isPremium: boolean
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
