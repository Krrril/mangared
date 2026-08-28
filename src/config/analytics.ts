/*
  Не секретные значения (Measurement ID и номер счётчика видны в открытом
  HTML/JS на любом сайте, который их использует) — но всё равно через env,
  не хардкод в коде, чтобы не тащить прод-идентификаторы в git и не путать
  их с локальной разработкой. Не заданы — соответствующая система просто
  не подключается (см. services/analytics/index.ts), как и с остальными
  необязательными интеграциями (Google/Яндекс OAuth, Turnstile).
*/
export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || undefined
export const YANDEX_METRIKA_ID = import.meta.env.VITE_YANDEX_METRIKA_ID || undefined
