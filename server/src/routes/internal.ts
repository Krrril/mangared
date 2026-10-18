import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { telegramConfig, isPostingEnabled, logTelegram } from '../services/telegram.js'
import { isDigestRunning, runDigest } from '../services/telegramDigest.js'
import { flushChapterPosts } from '../services/telegramPosts.js'

/*
  Внутренние эндпоинты для внешнего крона (cron-job.org и т.п.). Не для
  браузера и не в CORS-интерфейсе фронтенда: защита — секрет в заголовке
  X-Cron-Secret (переменная окружения CRON_SECRET на Render). Без заданного
  CRON_SECRET на сервере эндпоинт всегда отвечает 401.
*/
export const internalRouter = Router()

/** Сравнение секретов за постоянное время: хэшируем обе строки (одинаковая длина) и сравниваем timingSafeEqual. */
function secretMatches(provided: string | undefined, expected: string | null): boolean {
  if (!expected || !provided) return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * Запуск подборки новинок MangaDex. Подборка идёт десятки секунд (паузы между
 * сообщениями ≥ 3 с), а у крон-сервисов короткие таймауты, поэтому отвечаем
 * сразу 202, а работа продолжается в процессе; итог виден в админке (вкладка
 * Telegram) и в TelegramPost. Заодно отправляем накопившиеся главы Originals.
 */
internalRouter.post('/telegram-digest', (req, res) => {
  const cfg = telegramConfig()
  const header = req.headers['x-cron-secret']
  if (!secretMatches(typeof header === 'string' ? header : undefined, cfg.cronSecret)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!isPostingEnabled(cfg)) {
    res.status(200).json({ ok: true, skipped: 'disabled' })
    return
  }
  if (isDigestRunning()) {
    res.status(409).json({ ok: false, skipped: 'running' })
    return
  }
  res.status(202).json({ ok: true, started: true })
  void (async () => {
    try {
      await flushChapterPosts()
      const r = await runDigest()
      console.log(`[telegram] digest: titles=${r.titles} messages=${r.messages} failed=${r.failedMessages}${r.skipped ? ` skipped=${r.skipped}` : ''}`)
    } catch (err) {
      logTelegram('digest cron:', err)
    }
  })()
})
