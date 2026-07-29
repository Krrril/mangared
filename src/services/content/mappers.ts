import type { MDChapter, MDManga } from '../../api/mangadex/types'
import { getCoverUrl } from '../../api/mangadex/covers'
import { CONTENT_LANGUAGE } from '../../api/mangadex/constants'
import type { Chapter, CoverStyle, MangaType, Title } from './types'

/*
  Резервные градиенты на случай, если у тайтла нет обложки или картинка
  не загрузилась (см. CoverPlaceholder). Цвет выбирается детерминированно
  по id тайтла — один и тот же тайтл всегда получает один и тот же
  градиент, вместо случайного мигания при каждой перезагрузке.
*/
const FALLBACK_GRADIENTS: CoverStyle[] = [
  { from: '#4caf7d', to: '#10150f' },
  { from: '#3f8a5c', to: '#0e130f' },
  { from: '#5fa87a', to: '#111811' },
  { from: '#2f6e48', to: '#0c110d' },
  { from: '#6fbf94', to: '#121913' },
  { from: '#347a54', to: '#0d120e' },
  { from: '#7fcaa0', to: '#141c16' },
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function gradientForId(id: string): CoverStyle {
  return FALLBACK_GRADIENTS[hashString(id) % FALLBACK_GRADIENTS.length]
}

function pickLocalized(map: Record<string, string> | undefined, fallbackLang: string): string {
  if (!map) return ''
  return map[fallbackLang] ?? map.en ?? Object.values(map)[0] ?? ''
}

function typeFromLanguage(originalLanguage: string): MangaType {
  if (originalLanguage === 'ja') return 'Манга'
  if (originalLanguage === 'ko') return 'Манхва'
  if (originalLanguage === 'zh' || originalLanguage === 'zh-hk') return 'Маньхуа'
  return 'Комикс'
}

function cleanDescription(text: string): string {
  // Убираем markdown-ссылки вида [текст](url) и лишние переносы строк из описаний MangaDex
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\r?\n{2,}/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim()
}

function relationshipNames(manga: MDManga, type: string): string[] {
  return manga.relationships
    .filter((r) => r.type === type)
    .map((r) => (typeof r.attributes?.name === 'string' ? r.attributes.name : null))
    .filter((n): n is string => !!n)
}

export function mapMangaToTitle(manga: MDManga, rating = 0): Title {
  const { attributes } = manga
  const authors = relationshipNames(manga, 'author')
  const artists = relationshipNames(manga, 'artist').filter((a) => !authors.includes(a))
  const genres = attributes.tags
    .filter((t) => t.attributes.group === 'genre')
    .slice(0, 4)
    .map((t) => pickLocalized(t.attributes.name, 'en'))

  const lastChapter = attributes.lastChapter ? Number.parseFloat(attributes.lastChapter) : 0

  return {
    id: manga.id,
    name: pickLocalized(attributes.title, CONTENT_LANGUAGE) || pickLocalized(attributes.title, attributes.originalLanguage),
    author: authors.join(', ') || 'Неизвестен',
    artist: artists.length > 0 ? artists.join(', ') : undefined,
    type: typeFromLanguage(attributes.originalLanguage),
    rating,
    genres,
    description: cleanDescription(pickLocalized(attributes.description, CONTENT_LANGUAGE)),
    cover: gradientForId(manga.id),
    coverUrl: getCoverUrl(manga, 256),
    coverUrlLarge: getCoverUrl(manga, 512),
    chaptersCount: Number.isFinite(lastChapter) ? lastChapter : 0,
    isNew: false,
  }
}

export function mapChapterToLocal(chapter: MDChapter, titleId: string, alternateIds: string[] = []): Chapter {
  const { attributes } = chapter
  const group = chapter.relationships.find((r) => r.type === 'scanlation_group')
  const groupName = typeof group?.attributes?.name === 'string' ? group.attributes.name : undefined

  return {
    id: chapter.id,
    titleId,
    number: attributes.chapter ? Number.parseFloat(attributes.chapter) : 0,
    title: attributes.title ?? undefined,
    releasedAt: attributes.readableAt,
    translatedLanguage: attributes.translatedLanguage,
    isExternal: !!attributes.externalUrl,
    externalUrl: attributes.externalUrl ?? undefined,
    scanlationGroup: groupName,
    alternateIds: alternateIds.length > 0 ? alternateIds : undefined,
  }
}
