import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, ExternalLink } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import SocialIcon from '../../components/SocialIcon'
import { useAuth } from '../../services/auth/AuthContext'
import { getAuthorProfile, toggleFollowAuthor } from '../../services/originals/api'
import type { PublicAuthorProfile } from '../../services/originals/types'
import styles from './AuthorProfile.module.css'

export default function AuthorProfile() {
  const { t } = useTranslation()
  const { username } = useParams<{ username: string }>()
  const { token } = useAuth()

  const [profile, setProfile] = useState<PublicAuthorProfile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    if (!username) return
    getAuthorProfile(username, token)
      .then(setProfile)
      .catch(() => setNotFound(true))
  }, [username, token])

  async function handleFollowToggle() {
    if (!token || !username || !profile) return
    setFollowBusy(true)
    try {
      const { following } = await toggleFollowAuthor(token, username)
      setProfile((p) => (p ? { ...p, isFollowing: following, followersCount: p.followersCount + (following ? 1 : -1) } : p))
    } catch {
      // тихо игнорируем — счётчик просто не обновится, не критично для UX
    } finally {
      setFollowBusy(false)
    }
  }

  if (notFound) {
    return (
      <MainLayout>
        <p className={styles.hint}>{t('author.notFound')}</p>
      </MainLayout>
    )
  }

  if (!profile) {
    return (
      <MainLayout>
        <p className={styles.hint}>{t('common.loading')}</p>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className={styles.header}>
        <div className={styles.avatar}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName} referrerPolicy="no-referrer" />
          ) : (
            <span>{profile.displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{profile.displayName}</h1>
          <p className={styles.username}>@{profile.username}</p>

          {profile.socialLinks.length > 0 && (
            <div className={styles.socialLinks}>
              {profile.socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLinkIcon}
                  title={link.label}
                  aria-label={link.label}
                >
                  <SocialIcon label={link.label} size={18} />
                </a>
              ))}
            </div>
          )}

          {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

          <div className={styles.stats}>
            <span>
              <strong>{profile.followersCount}</strong> {t('author.followers')}
            </span>
            <span>
              <strong>{profile.worksCount}</strong> {t('author.works')}
            </span>
            <span>
              <strong>{profile.totalReads}</strong> {t('author.reads')}
            </span>
          </div>

          <div className={styles.actions}>
            {token && !profile.isOwnProfile && (
              <button
                type="button"
                className={profile.isFollowing ? styles.followingButton : styles.followButton}
                onClick={handleFollowToggle}
                disabled={followBusy}
              >
                <Heart size={15} fill={profile.isFollowing ? 'currentColor' : 'none'} />
                {profile.isFollowing ? t('author.following') : t('author.follow')}
              </button>
            )}
            {profile.boostyUrl && (
              <a href={profile.boostyUrl} target="_blank" rel="noopener noreferrer" className={styles.supportButton}>
                <ExternalLink size={15} />
                {t('author.support')}
              </a>
            )}
          </div>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>{t('author.worksHeading', { count: profile.mangas.length })}</h2>

      {profile.mangas.length === 0 ? (
        <p className={styles.hint}>{t('author.noWorks')}</p>
      ) : (
        <div className={styles.worksGrid}>
          {profile.mangas.map((m) => (
            <Link key={m.id} to={`/originals/${m.id}`} className={styles.workCard}>
              <CoverPlaceholder
                cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                name={m.title}
                imageUrl={m.coverUrl ?? undefined}
                className={styles.workCover}
              />
              <p className={styles.workTitle}>{m.title}</p>
              <span className={styles.workMeta}>{t('common.chapter', { number: m.chaptersCount })}</span>
            </Link>
          ))}
        </div>
      )}
    </MainLayout>
  )
}
