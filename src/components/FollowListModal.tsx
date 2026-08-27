import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAuthorFollowers, getAuthorFollowing } from '../services/originals/api'
import type { AuthorSummary, FollowerEntry } from '../services/originals/types'
import styles from './FollowListModal.module.css'

interface Props {
  username: string
  /** followers — кто подписан на этот профиль; following — на кого подписан сам этот профиль */
  mode: 'followers' | 'following'
  onClose: () => void
}

type Entry = { key: string; name: string; avatarUrl: string | null; href: string | null }

/** Список подписчиков/подписок автора — открывается кликом по счётчику на AuthorProfile.tsx. */
export default function FollowListModal({ username, mode, onClose }: Props) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const request =
      mode === 'followers'
        ? getAuthorFollowers(username).then((rows: FollowerEntry[]) =>
            rows.map((r) => ({
              key: r.userId,
              name: r.name,
              avatarUrl: r.avatarUrl,
              href: r.profileUsername ? `/author/${r.profileUsername}` : null,
            })),
          )
        : getAuthorFollowing(username).then((rows: AuthorSummary[]) =>
            rows.map((a) => ({ key: a.id, name: a.displayName, avatarUrl: a.avatarUrl, href: `/author/${a.username}` })),
          )

    request.then(setEntries).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [username, mode])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{mode === 'followers' ? t('author.followersHeading') : t('author.followingHeading')}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>

        {error && <p className={styles.state}>{error}</p>}
        {!error && !entries && <p className={styles.state}>{t('common.loading')}</p>}
        {!error && entries && entries.length === 0 && <p className={styles.state}>{t('author.followListEmpty')}</p>}

        {entries && entries.length > 0 && (
          <ul className={styles.list}>
            {entries.map((e) =>
              e.href ? (
                <Link key={e.key} to={e.href} className={styles.row} onClick={onClose}>
                  <FollowAvatar name={e.name} avatarUrl={e.avatarUrl} />
                  <span className={styles.name}>{e.name}</span>
                </Link>
              ) : (
                <div key={e.key} className={`${styles.row} ${styles.rowStatic}`}>
                  <FollowAvatar name={e.name} avatarUrl={e.avatarUrl} />
                  <span className={styles.name}>{e.name}</span>
                </div>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

function FollowAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div className={styles.avatar}>
      {avatarUrl ? <img src={avatarUrl} alt={name} referrerPolicy="no-referrer" /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </div>
  )
}
