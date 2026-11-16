import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Heart, MessageCircle, Crown, Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NotificationEntry } from '../services/notifications/api'
import styles from './NotificationRow.module.css'

/**
 * "5 мин. назад" / "5 min. ago" и т.п. на языке интерфейса (Intl.RelativeTimeFormat,
 * узкий стиль). Если язык не поддерживается — короткая запись 5m / 2h / 3d.
 */
function timeAgo(iso: string, lng: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  const hours = Math.round(minutes / 60)
  const [value, unit] = minutes < 1 ? [0, 'second'] : minutes < 60 ? [minutes, 'minute'] : hours < 24 ? [hours, 'hour'] : [Math.round(hours / 24), 'day']
  try {
    return new Intl.RelativeTimeFormat(lng, { numeric: 'auto', style: 'narrow' }).format(-value, unit as Intl.RelativeTimeFormatUnit)
  } catch {
    return minutes < 60 ? `${minutes}m` : hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`
  }
}

/** "Навсегда" в БД — условная дата 2099-12-31 (см. server/src/constants/premium.ts). */
const isForeverDate = (iso: string) => new Date(iso).getUTCFullYear() >= 2099

interface Props {
  entry: NotificationEntry
  /** Клик по конкретной строке — помечает именно её прочитанной (см. задачу про счётчик непрочитанных), не весь список. */
  onRead: (id: string) => void
}

export default function NotificationRow({ entry, onRead }: Props) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const lng = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const actorName = entry.actor?.name ?? t('notifications.someone')

  function handleClick() {
    if (!entry.read) onRead(entry.id)
  }

  const time = timeAgo(entry.createdAt, lng)

  // --- Premium: заголовок по виду + (необязательно) текст администрации, раскрывается целиком. Только текст, без ссылок.
  if (entry.type === 'premium') {
    const forever = entry.until ? isForeverDate(entry.until) : false
    const date = entry.until ? new Date(entry.until).toLocaleDateString(lng) : ''
    const headline =
      entry.premiumKind === 'revoked'
        ? t('notifications.premiumRevoked')
        : entry.premiumKind === 'message'
          ? t('notifications.premiumMessage')
          : forever || !entry.until
            ? t('notifications.premiumGrantedForever')
            : entry.premiumKind === 'extended'
              ? t('notifications.premiumExtended', { date })
              : t('notifications.premiumGranted', { date })
    const message = entry.message?.trim() || null
    return (
      <button
        type="button"
        className={styles.row}
        aria-expanded={message ? expanded : undefined}
        onClick={() => {
          handleClick()
          if (message) setExpanded((v) => !v)
        }}
      >
        <span className={`${styles.icon} ${styles.iconPremium}`}>
          <Crown size={16} />
        </span>
        <span className={styles.text}>
          <strong>{headline}</strong>
          {message && <span className={expanded ? styles.messageFull : styles.messageClamp}>{message}</span>}
          {message && <span className={styles.toggleHint}>{expanded ? t('notifications.showLess') : t('notifications.showMore')}</span>}
        </span>
        <span className={styles.time}>{time}</span>
        {!entry.read && <span className={styles.unreadDot} />}
      </button>
    )
  }

  const known = entry.type === 'follow' || entry.type === 'like' || entry.type === 'comment'
  const icon = !known ? (
    <Bell size={16} />
  ) : entry.type === 'follow' ? (
    <UserPlus size={16} />
  ) : entry.type === 'comment' ? (
    <MessageCircle size={16} />
  ) : (
    <Heart size={16} fill="currentColor" />
  )
  // Неизвестный тип (например, новый тип с более свежего backend) — нейтральный текст, а не "лайк".
  const text = !known
    ? t('notifications.generic')
    : entry.type === 'follow'
      ? t('notifications.newFollower', { name: actorName })
      : entry.type === 'comment'
        ? t('notifications.newComment', { name: actorName, title: entry.manga?.title ?? t('notifications.yourWork') })
        : t('notifications.newLike', { name: actorName, title: entry.manga?.title ?? t('notifications.yourWork') })

  const href =
    entry.type === 'follow' && entry.actor?.username
      ? `/author/${entry.actor.username}`
      : entry.manga && entry.type === 'comment' && entry.chapterId
        ? `/originals/${entry.manga.id}/read/${entry.chapterId}`
        : known && entry.manga
          ? `/originals/${entry.manga.id}`
          : null

  const iconClass = !known
    ? styles.iconGeneric
    : entry.type === 'follow'
      ? styles.iconFollow
      : entry.type === 'comment'
        ? styles.iconComment
        : styles.iconLike

  const content = (
    <>
      <span className={`${styles.icon} ${iconClass}`}>{icon}</span>
      <span className={styles.text}>{text}</span>
      <span className={styles.time}>{time}</span>
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
