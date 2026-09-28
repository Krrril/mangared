/*
  Запасные адреса страниц глав MangaDex. Основной URL страницы строится от
  baseUrl, который выдал at-home (обычно один узел сети @Home, см.
  getChapterPageUrls). Этот узел бывает больным именно на части глав — он
  отвечает 429/5xx на все запросы этой главы, и повтор того же URL ничего не
  даёт (это и была причина массовых "битых" глав). Поэтому для каждой
  страницы запоминаем запасные адреса: оригинальный сервер
  uploads.mangadex.org (тот же hash и имена файлов — документация MangaDex
  прямо допускает его как baseUrl) и режим data-saver. ImageWithRetry
  перебирает их по порядку. Реестр вынесен в отдельный модуль, чтобы
  Reader.tsx продолжал работать с обычным массивом строк pageUrls.
*/
const fallbacksByUrl = new Map<string, string[]>()

export const MANGADEX_ORIGIN = 'https://uploads.mangadex.org'

export function registerPageFallbacks(url: string, fallbacks: string[]): void {
  fallbacksByUrl.set(url, fallbacks)
}

export function getPageFallbacks(url: string): string[] {
  return fallbacksByUrl.get(url) ?? []
}

/** Узел сети @Home (а не сам MangaDex): для таких хостов нужен репорт результатов и запасные адреса. */
export function isHomeNode(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.mangadex.network')
  } catch {
    return false
  }
}
