import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

/*
  Уведомления о Premium (type='premium'): выдан / продлён / снят / сообщение
  от администрации. Текст сообщения хранится как есть и показывается
  пользователю ТОЛЬКО как обычный текст (React экранирует, ссылки не
  делаются кликабельными) — см. src/components/NotificationRow.tsx.

  Защита от повторной отправки одного и того же сообщения:
    - личное сообщение: тому же пользователю тот же текст не уходит дважды за
      24 часа (ключ — хэш текста в Notification.dedupeKey) + замок в памяти от
      двойного клика (сервер один);
    - массовая рассылка: уникальный ключ PremiumBroadcast(messageHash, day) и
      проверка последних 24 часов (см. routes/admin.ts).
*/

export const PREMIUM_MESSAGE_MAX = 1000
export const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

export type PremiumKind = 'granted' | 'extended' | 'revoked' | 'message'

/** Хэш нормализованного текста (переводы строк и пробелы по краям не различаются). */
export function messageHash(message: string): string {
  return createHash('sha256').update(message.replace(/\r\n/g, '\n').trim()).digest('hex')
}

/** Данные уведомления о Premium для prisma.notification.create / createMany. */
export function premiumNotificationData(
  userId: string,
  kind: PremiumKind,
  opts: { until?: Date | null; message?: string | null } = {},
): Prisma.NotificationUncheckedCreateInput {
  const message = opts.message?.trim() || null
  return {
    userId,
    type: 'premium',
    premiumKind: kind,
    message,
    until: opts.until ?? null,
    dedupeKey: kind === 'message' && message ? messageHash(message) : null,
  }
}

const inFlight = new Set<string>()

/**
 * Личное сообщение. 'duplicate' — тот же текст этому пользователю уже ушёл за
 * последние 24 часа (или такая же отправка прямо сейчас выполняется).
 */
export async function sendPremiumMessageToUser(userId: string, message: string): Promise<'sent' | 'duplicate'> {
  const hash = messageHash(message)
  const lock = `${userId}:${hash}`
  if (inFlight.has(lock)) return 'duplicate'
  inFlight.add(lock)
  try {
    const dup = await prisma.notification.findFirst({
      where: { userId, type: 'premium', premiumKind: 'message', dedupeKey: hash, createdAt: { gt: new Date(Date.now() - DEDUPE_WINDOW_MS) } },
      select: { id: true },
    })
    if (dup) return 'duplicate'
    await prisma.notification.create({ data: premiumNotificationData(userId, 'message', { message }) })
    return 'sent'
  } finally {
    inFlight.delete(lock)
  }
}

/** UTC-день для уникального ключа рассылки. */
export const broadcastDay = (d = new Date()) => d.toISOString().slice(0, 10)
