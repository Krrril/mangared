import type { CookieOptions } from 'express'

/*
  Общие константы/настройки кук для дедупликации визитов (см.
  routes/stats.ts) и исключения собственных заходов владельца (см.
  POST /admin/exclude-visits в routes/admin.ts) — один файл, чтобы оба
  роута не могли разъехаться в названии куки или в SameSite/Secure.
*/

export const VISIT_ID_COOKIE = 'visit_id'
export const OWNER_COOKIE = 'is_owner'

// 9 часов — середина запрошенного диапазона 8-10.
export const VISIT_SESSION_MS = 9 * 60 * 60 * 1000
export const OWNER_EXCLUSION_MS = 365 * 24 * 60 * 60 * 1000

const isProd = process.env.NODE_ENV === 'production'

/**
 * secure/sameSite различаются между продом и локальной разработкой не
 * по прихоти, а по необходимости: фронтенд и бэкенд — разные origin
 * (mangagreen.com и onrender.com), значит куки кросс-доменные, а
 * SameSite=None браузер принимает только вместе с Secure (HTTPS). На
 * localhost HTTPS нет вообще, но фронтенд:5173 и бэкенд:4000 на одном
 * hostname — браузер уже считает их same-site, поэтому Lax без Secure
 * там прекрасно работает и не требует SameSite=None.
 */
export function visitCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge,
    path: '/',
  }
}
