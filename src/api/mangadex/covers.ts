import { COVER_BASE } from './constants'
import type { MDManga } from './types'

export type CoverSize = 256 | 512 | 'original'

/** Находим relationship с типом cover_art и достаём его fileName. */
export function getCoverFileName(manga: MDManga): string | null {
  const rel = manga.relationships.find((r) => r.type === 'cover_art')
  const fileName = rel?.attributes?.fileName
  return typeof fileName === 'string' ? fileName : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROXY_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|gif|webp)$/i

/**
 * Строим URL обложки. Копий у нас нет: обложка идёт через наш прокси
 * /covers/<uuid>/<файл> (Vercel Edge Function с кэшем на краю, см.
 * api/cover.ts) — CDN MangaDex отдаёт браузерам чужих сайтов 403
 * "Bot challenge not passed". Имена файлов не по стандартной форме
 * (uuid.расширение) прокси не принимает — для них остаётся прямой адрес.
 * CoverImage (см. coverSources) в самом конце пробует и прямой адрес.
 */
export function buildCoverUrl(mangaId: string, fileName: string, size: CoverSize = 512): string {
  const suffix = size === 'original' ? '' : `.${size}.jpg`
  if (UUID_RE.test(mangaId) && PROXY_FILE_RE.test(fileName)) return `/covers/${mangaId}/${fileName}${suffix}`
  return `${COVER_BASE}/${mangaId}/${fileName}${suffix}`
}

export function getCoverUrl(manga: MDManga, size: CoverSize = 512): string | undefined {
  const fileName = getCoverFileName(manga)
  return fileName ? buildCoverUrl(manga.id, fileName, size) : undefined
}
