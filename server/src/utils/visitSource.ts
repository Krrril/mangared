/*
  Источник визита: домен реферера + utm-метки (см. VisitLog). Клиент уже
  присылает только домен, но сервер не доверяет и нормализует сам — в БД
  не должно попасть ни пути, ни query, ни произвольно длинной строки.
*/

const MAX_UTM_LEN = 100
const MAX_DOMAIN_LEN = 100

/** Домен без "www.", нижний регистр; null — пусто/мусор/это сам сайт. */
export function normalizeReferrerDomain(raw: string | undefined | null): string | null {
  if (!raw) return null
  let host = raw.trim().toLowerCase()
  if (!host) return null
  // Допускаем и полный URL, и просто домен — берём только hostname.
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname
    } catch {
      return null
    }
  }
  host = host.split('/')[0].split('?')[0].split('#')[0].split(':')[0].replace(/^www\./, '')
  if (!host || host.length > MAX_DOMAIN_LEN || !/^[a-z0-9.-]+$/.test(host) || !host.includes('.')) return null
  if (isOwnDomain(host)) return null
  return host
}

export function isOwnDomain(host: string): boolean {
  return host === 'mangagreen.com' || host.endsWith('.mangagreen.com') || host.endsWith('.vercel.app') || host === 'localhost'
}

export function normalizeUtm(raw: string | undefined | null): string | null {
  if (!raw) return null
  const v = raw.trim().slice(0, MAX_UTM_LEN)
  return v || null
}

export type SourceGroup = 'direct' | 'google' | 'telegram' | 'tiktok' | 'reddit' | 'other'

function groupFromToken(token: string): SourceGroup | null {
  const t = token.toLowerCase()
  if (/(^|\.)google\.|^google$|^g$|googlesearch/.test(t)) return 'google'
  if (/(^|\.)(t\.me|telegram\.org|telegram\.me)$|^telegram$|^tg$|^t\.me$/.test(t)) return 'telegram'
  if (/(^|\.)tiktok\.com$|^tiktok$|^tt$/.test(t)) return 'tiktok'
  if (/(^|\.)(reddit\.com|redd\.it)$|^reddit$/.test(t)) return 'reddit'
  return null
}

/**
 * utm_source приоритетнее реферера: ссылка с меткой — явное намерение
 * (например, в сторис TikTok реферера нет, а utm_source=tiktok есть).
 * Любой непустой источник, не попавший в именованные группы, — "other".
 */
export function classifySource(referrerDomain: string | null, utmSource: string | null): SourceGroup {
  if (utmSource) return groupFromToken(utmSource) ?? 'other'
  if (referrerDomain) return groupFromToken(referrerDomain) ?? 'other'
  return 'direct'
}
