import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  isPremiumActive,
  isPremiumAccentColor,
  isPremiumBundle,
  isPremiumFrame,
  isPremiumBackground,
  PREMIUM_ACCENT_COLORS,
} from '../constants/premium.js'

export const premiumRouter = Router()

/*
  MangaGreen Premium, этап 1 — чистая косметика (см. задачу, юридическое
  ограничение: не касается каталога MangaDex). Выбор рамки/фона/цвета
  хранится на User безусловно (см. schema.prisma) — сохранять его может
  только Premium-пользователь (проверка isPremiumActive ниже), но само
  значение переживает истечение подписки: снова становится premium — и
  оформление возвращается без повторной настройки.
*/

premiumRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { premiumUntil: true, avatarFrame: true, profileBackground: true, accentColor: true, themeBundle: true },
  })
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' })
    return
  }
  res.json({ ...user, isPremium: isPremiumActive(user.premiumUntil) })
})

/**
 * Применить готовую связку целиком: рамка+фон+акцент одним запросом
 * (см. E4/E7 — "выбирает связку одним нажатием"). themeBundle запоминает,
 * какая именно, для подсветки в "Готовые связки" на странице настроек.
 */
const applyBundleSchema = z.object({ bundle: z.string() })

premiumRouter.post('/bundle', requireAuth, async (req, res) => {
  const parsed = applyBundleSchema.safeParse(req.body)
  if (!parsed.success || !isPremiumBundle(parsed.data.bundle)) {
    res.status(400).json({ error: 'Некорректная связка' })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { premiumUntil: true } })
  if (!isPremiumActive(user?.premiumUntil ?? null)) {
    res.status(403).json({ error: 'Доступно только с Premium' })
    return
  }
  const bundle = parsed.data.bundle
  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      themeBundle: bundle,
      avatarFrame: bundle,
      profileBackground: bundle,
      accentColor: PREMIUM_ACCENT_COLORS[bundle],
    },
    select: { avatarFrame: true, profileBackground: true, accentColor: true, themeBundle: true },
  })
  res.json(updated)
})

/** "Своя сборка" — рамка/фон/цвет по отдельности (см. E7). Любое изменённое поле снимает пометку themeBundle: это больше не "ровно эта связка". */
const customBuildSchema = z.object({
  avatarFrame: z.string().nullable().optional(),
  profileBackground: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
})

premiumRouter.patch('/customize', requireAuth, async (req, res) => {
  const parsed = customBuildSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные данные' })
    return
  }
  const { avatarFrame, profileBackground, accentColor } = parsed.data
  if (avatarFrame !== undefined && avatarFrame !== null && !isPremiumFrame(avatarFrame)) {
    res.status(400).json({ error: 'Некорректная рамка' })
    return
  }
  if (profileBackground !== undefined && profileBackground !== null && !isPremiumBackground(profileBackground)) {
    res.status(400).json({ error: 'Некорректный фон' })
    return
  }
  if (accentColor !== undefined && accentColor !== null && !isPremiumAccentColor(accentColor)) {
    res.status(400).json({ error: 'Некорректный цвет' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { premiumUntil: true } })
  if (!isPremiumActive(user?.premiumUntil ?? null)) {
    res.status(403).json({ error: 'Доступно только с Premium' })
    return
  }

  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: { avatarFrame, profileBackground, accentColor, themeBundle: null },
    select: { avatarFrame: true, profileBackground: true, accentColor: true, themeBundle: true },
  })
  res.json(updated)
})
