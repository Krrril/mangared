import { Router } from 'express'

export const mangadexRouter = Router()

const MANGADEX_BASE = 'https://api.mangadex.org'

/*
  Прокси к MangaDex API. Изначально фронтенд ходил на api.mangadex.org
  напрямую из браузера (CORS у них открыт) — работало локально, но на
  реальном домене (Vercel) MangaDex стал отдавать ответ без заголовка
  Access-Control-Allow-Origin, и браузер блокирует чтение (см. DECISIONS.md).
  Запрос сервер-сервер CORS не касается вообще, поэтому просто
  пересылаем путь и query как есть.
*/
mangadexRouter.get('/*', async (req, res) => {
  try {
    const upstream = await fetch(`${MANGADEX_BASE}${req.url}`)
    const body = await upstream.text()
    res.status(upstream.status).type('application/json').send(body)
  } catch (err) {
    console.error('Ошибка прокси к MangaDex', err)
    res.status(502).json({ error: 'MangaDex временно недоступен' })
  }
})
