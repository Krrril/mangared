import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { isPremiumActive, isPremiumPermanent, isPremiumForever, isPremiumAccentColor, isPremiumFrame } from '../constants/premium.js'

export const premiumRouter = Router()

/*
  MangaGreen Premium, этап 1 — чистая косметика (см. задачу, юридическое
  ограничение: не касается каталога MangaDex). Выбор рамки/цвета хранится
  на User безусловно (см. schema.prisma) — сохранять его может только
  Premium-пользователь (проверка isPremiumActive ниже), но само значение
  переживает истечение подписки: снова становится Premium — и оформление
  возвращается без повторной настройки.
*/

premiumRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { isAdmin: true, premiumUntil: true, avatarFrame: true, accentColor: true },
  })
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' })
    return
  }
  const { isAdmin: _isAdmin, ...rest } = user
  res.json({
    ...rest,
    isPremium: isPremiumActive(user),
    // Админ: Premium постоянный по роли, premiumUntil для него не показываем (в БД он и не пишется).
    premiumPermanent: isPremiumPermanent(user),
    premiumForever: isPremiumForever(user.premiumUntil),
  })
})

/** Рамка аватара и акцентный цвет — по отдельности, любое поле необязательно (меняем только то, что прислали). */
const customizeSchema = z.object({
  avatarFrame: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
})

premiumRouter.patch('/customize', requireAuth, async (req, res) => {
  const parsed = customizeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные данные' })
    return
  }
  const { avatarFrame, accentColor } = parsed.data
  if (avatarFrame !== undefined && avatarFrame !== null && !isPremiumFrame(avatarFrame)) {
    res.status(400).json({ error: 'Некорректная рамка' })
    return
  }
  if (accentColor !== undefined && accentColor !== null && !isPremiumAccentColor(accentColor)) {
    res.status(400).json({ error: 'Некорректный цвет' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { isAdmin: true, premiumUntil: true } })
  if (!isPremiumActive(user)) {
    res.status(403).json({ error: 'Доступно только с Premium' })
    return
  }

  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: { avatarFrame, accentColor },
    select: { avatarFrame: true, accentColor: true },
  })
  res.json(updated)
})
