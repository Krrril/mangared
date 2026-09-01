import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, ExternalLink, Pencil, X, Check } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import CoverDropzone from '../../components/CoverDropzone'
import FollowListModal from '../../components/FollowListModal'
import SeoHead from '../../components/SeoHead'
import AgeRatingBadge from '../../components/AgeRatingBadge'
import { useAuth } from '../../services/auth/AuthContext'
import { getAuthorProfile, toggleFollowAuthor, updateMyAuthorProfile } from '../../services/originals/api'
import type { PublicAuthorProfile, SocialLink } from '../../services/originals/types'
import styles from './AuthorProfile.module.css'

interface LinkRow extends SocialLink {
  id: string
}

const MAX_LINKS = 6

export default function AuthorProfile() {
  const { t } = useTranslation()
  const { username } = useParams<{ username: string }>()
  const { token, refreshUser } = useAuth()

  const [profile, setProfile] = useState<PublicAuthorProfile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [followListMode, setFollowListMode] = useState<'followers' | 'following' | null>(null)

  const [editing, setEditing] = useState(false)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [profileLinks, setProfileLinks] = useState<LinkRow[]>([])
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

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

  function startEditing() {
    if (!profile) return
    setProfileAvatarUrl(profile.avatarUrl)
    setProfileLinks(profile.socialLinks.map((l) => ({ id: crypto.randomUUID(), ...l })))
    setProfileError(null)
    setEditing(true)
  }

  function addLinkRow() {
    setProfileLinks((prev) => (prev.length >= MAX_LINKS ? prev : [...prev, { id: crypto.randomUUID(), label: '', url: '' }]))
  }

  function updateLinkRow(id: string, patch: Partial<Pick<LinkRow, 'label' | 'url'>>) {
    setProfileLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function removeLinkRow(id: string) {
    setProfileLinks((prev) => prev.filter((l) => l.id !== id))
  }

  async function handleSaveProfile() {
    if (!token) return
    const socialLinks = profileLinks.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.label && l.url)

    setProfileSaving(true)
    setProfileError(null)
    try {
      const updated = await updateMyAuthorProfile(token, { avatarUrl: profileAvatarUrl ?? '', socialLinks })
      setProfile((p) => (p ? { ...p, avatarUrl: updated.avatarUrl, socialLinks: updated.socialLinks } : p))
      setEditing(false)
      refreshUser()
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setProfileSaving(false)
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
      <SeoHead
        title={t('seo.authorPage.titleTemplate', { name: profile.displayName, username: profile.username })}
        description={t('seo.authorPage.descriptionTemplate', { name: profile.displayName })}
      />
      <div className={styles.header}>
        <div className={styles.avatar}>
          {(editing ? profileAvatarUrl : profile.avatarUrl) ? (
            <img src={(editing ? profileAvatarUrl : profile.avatarUrl) ?? undefined} alt={profile.displayName} referrerPolicy="no-referrer" />
          ) : (
            <span>{profile.displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className={styles.headerInfo}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{profile.displayName}</h1>
            {profile.isOwnProfile && !editing && (
              <button type="button" className={styles.editButton} onClick={startEditing}>
                <Pencil size={14} />
                {t('creator.profile.edit')}
              </button>
            )}
          </div>
          <p className={styles.username}>@{profile.username}</p>

          {editing ? (
            <div className={styles.editForm}>
              <label className={styles.label}>{t('creator.profile.avatar')}</label>
              <CoverDropzone value={profileAvatarUrl} onChange={setProfileAvatarUrl} folder="avatars" />

              <label className={styles.label}>{t('creator.profile.links')}</label>
              <div className={styles.linkRows}>
                {profileLinks.map((link) => (
                  <div key={link.id} className={styles.linkRow}>
                    <input
                      type="text"
                      className={styles.linkInput}
                      placeholder={t('creator.profile.linkLabelPlaceholder') ?? ''}
                      value={link.label}
                      maxLength={30}
                      onChange={(e) => updateLinkRow(link.id, { label: e.target.value })}
                    />
                    <input
                      type="text"
                      className={styles.linkInput}
                      placeholder={t('creator.profile.linkUrlPlaceholder') ?? ''}
                      value={link.url}
                      onChange={(e) => updateLinkRow(link.id, { url: e.target.value })}
                    />
                    <button
                      type="button"
                      className={styles.removeLinkButton}
                      onClick={() => removeLinkRow(link.id)}
                      aria-label={t('creator.detail.removeDraft') ?? ''}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {profileLinks.length < MAX_LINKS && (
                <button type="button" className={styles.addLinkButton} onClick={addLinkRow}>
                  + {t('creator.profile.addLink')}
                </button>
              )}

              {profileError && <p className={styles.formError}>{profileError}</p>}

              <div className={styles.editFormActions}>
                <button type="button" className={styles.saveButton} onClick={handleSaveProfile} disabled={profileSaving}>
                  <Check size={15} />
                  {profileSaving ? t('common.loading') : t('creator.profile.save')}
                </button>
                <button type="button" className={styles.cancelEditButton} onClick={() => setEditing(false)} disabled={profileSaving}>
                  {t('creator.profile.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {profile.socialLinks.length > 0 && (
                <div className={styles.socialLinks}>
                  {profile.socialLinks.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className={styles.socialLinkPill}>
                      <ExternalLink size={13} />
                      {link.label}
                    </a>
                  ))}
                </div>
              )}

              {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

              <div className={styles.stats}>
                <button type="button" className={styles.statButton} onClick={() => setFollowListMode('followers')}>
                  <strong>{profile.followersCount}</strong> {t('author.followers')}
                </button>
                <button type="button" className={styles.statButton} onClick={() => setFollowListMode('following')}>
                  <strong>{profile.followingCount}</strong> {t('author.followingStat')}
                </button>
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
            </>
          )}
        </div>
      </div>

      <h2 className={styles.sectionHeading}>{t('author.worksHeading', { count: profile.mangas.length })}</h2>

      {profile.mangas.length === 0 ? (
        <p className={styles.hint}>{t('author.noWorks')}</p>
      ) : (
        <div className={styles.worksGrid}>
          {profile.mangas.map((m) => (
            <Link key={m.id} to={`/originals/${m.id}`} className={styles.workCard}>
              <div className={styles.workCoverWrap}>
                <CoverPlaceholder
                  cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                  name={m.title}
                  imageUrl={m.coverUrl ?? undefined}
                  className={styles.workCover}
                />
                <AgeRatingBadge rating={m.ageRating} className={styles.workAgeBadge} />
              </div>
              <p className={styles.workTitle}>{m.title}</p>
              <span className={styles.workMeta}>{t('common.chapter', { number: m.chaptersCount })}</span>
            </Link>
          ))}
        </div>
      )}

      {followListMode && username && (
        <FollowListModal username={username} mode={followListMode} onClose={() => setFollowListMode(null)} />
      )}
    </MainLayout>
  )
}
