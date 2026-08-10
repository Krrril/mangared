import type { Chapter, Title } from '../content/types'
import type { MangaContentType, PublicChapter, PublicMangaChapterSummary, PublicMangaDetail } from '../originals/types'

/*
  Reader.tsx изначально писан только под каталог MangaDex (services/content).
  Чтобы не делать отдельный компонент читалки для авторского контента (см.
  задачу — "переиспользуй существующий Reader"), здесь просто приводим форму
  ответов Originals API к тем же Title/Chapter, которые Reader уже понимает.
  Дальше вся логика читалки (пролистывание, конец главы, next/prev) работает
  одинаково для обоих источников — она ничего не знает про то, откуда взяты
  данные.
*/

const CONTENT_TYPE_LABEL: Record<MangaContentType, Title['type']> = {
  manga: 'Манга',
  manhwa: 'Манхва',
  comic: 'Комикс',
}

/** Манга читается справа-налево горизонтально, манхва — вертикальным скроллом, комикс — слева-направо. Пользователь может переключить в настройках, это только стартовое значение. */
export function defaultReaderSettings(contentType: MangaContentType): { mode: 'horizontal' | 'vertical'; direction: 'ltr' | 'rtl' } {
  switch (contentType) {
    case 'manga':
      return { mode: 'horizontal', direction: 'rtl' }
    case 'manhwa':
      return { mode: 'vertical', direction: 'ltr' }
    case 'comic':
      return { mode: 'horizontal', direction: 'ltr' }
  }
}

export function mapPublicMangaToTitle(manga: PublicMangaDetail): Title {
  return {
    id: manga.id,
    name: manga.title,
    author: manga.author.displayName,
    type: CONTENT_TYPE_LABEL[manga.contentType],
    rating: 0,
    genres: manga.genres,
    description: manga.description,
    cover: { from: '#2a2a3a', to: '#1a1a24' },
    coverUrl: manga.coverUrl ?? undefined,
    coverUrlLarge: manga.coverUrl ?? undefined,
    chaptersCount: manga.chapters.length,
  }
}

export function mapPublicChapterSummaryToChapter(c: PublicMangaChapterSummary, mangaId: string): Chapter {
  return {
    id: c.id,
    titleId: mangaId,
    number: c.number,
    title: c.title ?? undefined,
    releasedAt: c.publishedAt,
    translatedLanguage: 'en',
    isExternal: false,
  }
}

export function mapPublicChapterToChapter(c: PublicChapter): Chapter {
  return {
    id: c.id,
    titleId: c.mangaId,
    number: c.number,
    title: c.title ?? undefined,
    releasedAt: new Date().toISOString(),
    translatedLanguage: 'en',
    isExternal: false,
  }
}
