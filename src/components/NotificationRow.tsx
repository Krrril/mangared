import { Link } from 'react-router-dom'
import { UserPlus, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NotificationEntry } from '../services/notifications/api'
import styles from './NotificationRow.module.css'

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

interface Props {
  entry: NotificationEntry
  /** Клик по конкретной строке — помечает именно её прочитанной (см. задачу про счётчик непрочитанных), не весь список. */
  onRead: (id: string) => void
}

export default function NotificationRow({ entry, onRead }: Props) {
  const { t } = useTranslation()
  const actorName = entry.actor?.name ?? t('notifications.someone')

  const icon = entry.type === 'follow' ? <UserPlus size={16} /> : <Heart size={16} fill="currentColor" />
  const text =
    entry.type === 'follow'
      ? t('notifications.newFollower', { name: actorName })
      : t('notifications.newLike', { name: actorName, title: entry.manga?.title ?? t('notifications.yourWork') })

  const href = entry.type === 'follow' && entry.actor?.username ? `/author/${entry.actor.username}` : entry.manga ? `/originals/${entry.manga.id}` : null

  function handleClick() {
    if (!entry.read) onRead(entry.id)
  }

  const content = (
    <>
      <span className={`${styles.icon} ${entry.type === 'follow' ? styles.iconFollow : styles.iconLike}`}>{icon}</span>
      <span className={styles.text}>{text}</span>
      <span className={styles.time}>{timeAgo(entry.createdAt)}</span>
      {!entry.read && <span className={styles.unreadDot} />}
    </>
  )

  return href ? (
    <Link to={href} className={styles.row} onClick={handleClick}>
      {content}
    </Link>
  ) : (
    <button type="button" className={styles.row} onClick={handleClick}>
      {content}
    </button>
  )
}
