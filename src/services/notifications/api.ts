import { authorizedFetch } from '../auth/api'

/** 'premium' — уведомление о Premium; сервер в будущем может прислать и другие типы — фронтенд обязан пережить неизвестный. */
export type NotificationType = 'follow' | 'like' | 'comment' | 'premium'

export type PremiumNotificationKind = 'granted' | 'extended' | 'revoked' | 'message'

export interface NotificationActor {
  name: string
  avatarUrl: string | null
  username: string | null
}

export interface NotificationManga {
  id: string
  title: string
}

export interface NotificationEntry {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string
  actor: NotificationActor | null
  manga: NotificationManga | null
  /** Только для type='comment' под конкретной главой — null, если комментарий был под тайтлом целиком. */
  chapterId: string | null
  /** Только для type='premium' (старый backend полей не присылает). */
  premiumKind?: PremiumNotificationKind | null
  /** Текст администрации — показывать ТОЛЬКО как обычный текст. */
  message?: string | null
  until?: string | null
}

export function getNotifications(token: string): Promise<NotificationEntry[]> {
  return authorizedFetch('/notifications', token)
}

export function getUnreadNotificationCount(token: string): Promise<{ count: number }> {
  return authorizedFetch('/notifications/unread-count', token)
}

export function markAllNotificationsRead(token: string): Promise<{ ok: true }> {
  return authorizedFetch('/notifications/read-all', token, { method: 'POST' })
}

export function markNotificationRead(token: string, id: string): Promise<{ ok: true }> {
  return authorizedFetch(`/notifications/${id}/read`, token, { method: 'POST' })
}
