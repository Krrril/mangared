import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../db.js'

/*
  Ставится после requireAuth — req.userId уже проверен, здесь только
  смотрим isAdmin в базе. Флаг проставляется вручную (Prisma Studio или
  SQL UPDATE), никакого self-service — см. ARCHITECTURE.md, "Админ-панель".
*/
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: 'Не авторизован' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) {
    res.status(403).json({ error: 'Доступ только для администратора' })
    return
  }

  next()
}
