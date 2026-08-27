import { authorizedFetch } from '../auth/api'

export type NotificationType = 'follow' | 'like' | 'comment'

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
