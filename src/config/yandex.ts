/*
  Не сам вход (это redirect на бэкенд, см. usePublishCta-подобный паттерн
  в Auth.tsx), а только флаг "показывать ли кнопку вообще" — как и
  VITE_GOOGLE_CLIENT_ID, не секретный, просто пока не задан — кнопки нет,
  а не сломанная. Настоящий обмен кода на токен требует Client Secret,
  который остаётся только на бэкенде (YANDEX_CLIENT_SECRET, никогда не в
  этой переменной).
*/
export const YANDEX_CLIENT_ID = import.meta.env.VITE_YANDEX_CLIENT_ID || undefined
