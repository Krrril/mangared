import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../db.js'
import { isConfigured, isPostingEnabled, redact, sendMessage, telegramConfig } from '../services/telegram.js'
import { deleteLastDigest, isDigestRunning, runDigest } from '../services/telegramDigest.js'
import { retryTelegramPost } from '../services/telegramPosts.js'
import { TEXTS } from '../services/telegramTexts.js'

/*
  Вкладка "Telegram" в /admin. Подключается внутри adminRouter (routes/admin.ts)
  ПОСЛЕ requireAuth + requireAdmin — обычный пользователь получает 403.
  Значения токена/канала/секрета наружу не отдаются никогда — только булевы
  "задано / не задано".
*/
export const telegramAdminRouter = Router()

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }

async function logAdmin(adminId: string, action: string, details: string) {
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { name: true } })
  await prisma.adminActionLog.create({
    data: { adminId, adminName: admin?.name ?? 'unknown', action, targetType: 'telegram', targetId: 'channel', details },
  })
}

telegramAdminRouter.get(
  '/',
  wrap(async (_req, res) => {
    const cfg = telegramConfig()
    const [recent, pendingChapters, failedCount, lastDigest] = await Promise.all([
      prisma.telegramPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, kind: true, refId: true, label: true, status: true, error: true, messageId: true, batchId: true, createdAt: true },
      }),
      prisma.telegramPost.count({ where: { kind: 'original_chapter', status: 'pending' } }),
      prisma.telegramPost.count({ where: { status: 'failed' } }),
      prisma.telegramPost.findFirst({ where: { kind: 'digest', batchId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { batchId: true, createdAt: true } }),
    ])
    let lastDigestTitles = 0
    if (lastDigest?.batchId) lastDigestTitles = await prisma.telegramPost.count({ where: { kind: 'digest', batchId: lastDigest.batchId } })
    res.json({
      configured: { token: !!cfg.token, channel: !!cfg.channelId, cronSecret: !!cfg.cronSecret },
      ready: isConfigured(cfg),
      enabled: isPostingEnabled(cfg),
      flagEnabled: cfg.enabled,
      lang: cfg.lang,
      digestCovers: cfg.digestCovers,
      originalsPosts: cfg.originalsPosts,
      originalsCovers: cfg.originalsCovers,
      digestRunning: isDigestRunning(),
      pendingChapters,
      failedCount,
      lastDigest: lastDigest ? { at: lastDigest.createdAt, titles: lastDigestTitles } : null,
      posts: recent,
    })
  }),
)

/** Тестовое сообщение: беззвучно, в TelegramPost не пишется, работает и при выключенной автопубликации (нужны только токен и канал). */
telegramAdminRouter.post(
  '/test-message',
  wrap(async (req, res) => {
    const cfg = telegramConfig()
    if (!isConfigured(cfg)) {
      res.status(400).json({ error: 'Токен или канал не заданы в переменных окружения', code: 'not_configured' })
      return
    }
    const r = await sendMessage(TEXTS[cfg.lang].testMessage, { silent: true })
    await logAdmin(req.userId!, 'telegram.test_message', r.ok ? 'ok' : redact(r.error))
    if (!r.ok) {
      res.status(502).json({ error: r.error, code: 'telegram_error' })
      return
    }
    res.json({ ok: true, messageIds: r.messageIds })
  }),
)

/** Тестовая подборка: те же отбор и формат, но беззвучно и без записи в TelegramPost (тайтлы не "сгорают"). */
telegramAdminRouter.post(
  '/test-digest',
  wrap(async (req, res) => {
    const cfg = telegramConfig()
    if (!isConfigured(cfg)) {
      res.status(400).json({ error: 'Токен или канал не заданы в переменных окружения', code: 'not_configured' })
      return
    }
    if (isDigestRunning()) {
      res.status(409).json({ error: 'Подборка уже выполняется', code: 'running' })
      return
    }
    const r = await runDigest({ test: true, max: 8 })
    await logAdmin(req.userId!, 'telegram.test_digest', `titles=${r.titles} messages=${r.messages} failed=${r.failedMessages}`)
    res.status(r.ok || r.skipped === 'no_items' ? 200 : 502).json(r)
  }),
)

telegramAdminRouter.delete(
  '/last-digest',
  wrap(async (req, res) => {
    if (!isConfigured()) {
      res.status(400).json({ error: 'Токен или канал не заданы в переменных окружения', code: 'not_configured' })
      return
    }
    const r = await deleteLastDigest()
    await logAdmin(req.userId!, 'telegram.delete_last_digest', `deleted=${r.deletedMessages} released=${r.releasedTitles}${r.errors.length ? ` errors=${r.errors.length}` : ''}`)
    res.status(r.ok ? 200 : 400).json(r)
  }),
)

telegramAdminRouter.post(
  '/posts/:id/retry',
  wrap(async (req, res) => {
    const r = await retryTelegramPost(req.params.id)
    if (r.ok) await logAdmin(req.userId!, 'telegram.retry', req.params.id)
    res.status(r.ok ? 200 : 400).json(r)
  }),
)
