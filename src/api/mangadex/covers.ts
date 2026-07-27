import { COVER_BASE } from './constants'
import type { MDManga } from './types'

export type CoverSize = 256 | 512 | 'original'

/** Находим relationship с типом cover_art и достаём его fileName. */
export function getCoverFileName(manga: MDManga): string | null {
  const rel = manga.relationships.find((r) => r.type === 'cover_art')
  const fileName = rel?.attributes?.fileName
  return typeof fileName === 'string' ? fileName : null
}

/**
 * Строим URL обложки. MangaDex не хранит превью у нас — грузим их
 * напрямую с uploads.mangadex.org "на лету", своих копий не делаем.
 */
export function buildCoverUrl(mangaId: string, fileName: string, size: CoverSize = 512): string {
  const suffix = size === 'original' ? '' : `.${size}.jpg`
  return `${COVER_BASE}/${mangaId}/${fileName}${suffix}`
}

export function getCoverUrl(manga: MDManga, size: CoverSize = 512): string | undefined {
  const fileName = getCoverFileName(manga)
  return fileName ? buildCoverUrl(manga.id, fileName, size) : undefined
}
