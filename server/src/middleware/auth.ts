import type { NextFunction, Request, Response } from 'express'
import { verifyToken } from '../utils/jwt.js'

/*
  Простая аутентификация по JWT из заголовка Authorization: Bearer <token>.
  Никаких сессий на сервере — токен самодостаточен, поэтому не нужно
  хранить состояние между запросами (проще масштабировать позже).
*/

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Не авторизован' })
    return
  }

  try {
    const payload = verifyToken(token)
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Невалидный или истёкший токен' })
  }
}
