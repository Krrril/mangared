import { authorizedFetch } from '../auth/api'
import { getLocalFavoriteIds, clearLocalFavorites } from '../favorites'
import { getLocalProgress, clearLocalProgress } from '../progress'

interface BackendProgressEntry {
  mangaId: string
}

/*
  Перенос гостевых данных (localStorage) в аккаунт — вызывается один раз
  сразу после успешного входа/регистрации (см. AuthContext). Приоритет
  у БД: если для тайтла там уже есть прогресс (например, вход с другого
  устройства), локальная версия не перетирает её — добавляются только
  тайтлы, которых в БД ещё нет. Избранное так же не имеет "перезаписи":
  просто объединяем оба множества.

  Если что-то пошло не так (сеть, бэкенд недоступен) — гостевые данные
  специально НЕ чистим, чтобы не потерять их: следующий вход попробует
  перенести снова.
*/
export async function migrateGuestDataToAccount(token: string): Promise<void> {
  const localFavoriteIds = getLocalFavoriteIds()
  const localProgress = getLocalProgress()

  if (localFavoriteIds.length === 0 && localProgress.length === 0) return

  try {
    // Избранное — upsert на бэкенде идемпотентен, дубли не страшны
    for (const mangaId of localFavoriteIds) {
      await authorizedFetch('/favorites', token, {
        method: 'POST',
        body: JSON.stringify({ mangaId }),
      })
    }

    // Прогресс — сперва смотрим, что уже есть в БД, добавляем только недостающее
    if (localProgress.length > 0) {
      const serverProgress: BackendProgressEntry[] = await authorizedFetch('/progress', token)
      const existingMangaIds = new Set(serverProgress.map((p) => p.mangaId))

      for (const entry of localProgress) {
        if (existingMangaIds.has(entry.titleId)) continue // приоритет у БД — не перетираем
        await authorizedFetch('/progress', token, {
          method: 'PUT',
          body: JSON.stringify({
            mangaId: entry.titleId,
            chapterId: entry.chapterId,
            chapterNumber: entry.chapterNumber,
            pageNumber: entry.pageNumber,
          }),
        })
      }
    }

    clearLocalFavorites()
    clearLocalProgress()
  } catch (err) {
    console.error('Не удалось перенести гостевые данные в аккаунт — попробуем при следующем входе', err)
  }
}
