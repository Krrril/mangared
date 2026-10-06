import { authorizedFetch } from '../auth/api'

export interface PremiumMe {
  isPremium: boolean
  premiumUntil: string | null
  avatarFrame: string | null
  profileBackground: string | null
  accentColor: string | null
  themeBundle: string | null
}

export interface PremiumSelection {
  avatarFrame: string | null
  profileBackground: string | null
  accentColor: string | null
  themeBundle: string | null
}

export function getMyPremium(token: string): Promise<PremiumMe> {
  return authorizedFetch('/premium/me', token)
}

/** Применить готовую связку целиком (рамка+фон+акцент одним нажатием, см. E4). */
export function applyPremiumBundle(token: string, bundle: string): Promise<PremiumSelection> {
  return authorizedFetch('/premium/bundle', token, { method: 'POST', body: JSON.stringify({ bundle }) })
}

/** "Своя сборка" — любое поле по отдельности, см. E7. */
export function customizePremium(
  token: string,
  patch: { avatarFrame?: string | null; profileBackground?: string | null; accentColor?: string | null },
): Promise<PremiumSelection> {
  return authorizedFetch('/premium/customize', token, { method: 'PATCH', body: JSON.stringify(patch) })
}
