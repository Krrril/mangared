/*
  Site key для Cloudflare Turnstile — не секретный (в отличие от Secret
  Key на бэкенде, см. server/.env.example), можно спокойно хранить в
  переменной окружения фронтенда. Пока не задан — виджет на регистрации
  просто не показывается, как и с VITE_GOOGLE_CLIENT_ID (см. src/config/google.ts).
*/
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined
