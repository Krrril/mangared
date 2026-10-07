import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Heart, ExternalLink, Pencil, X, Check } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import LanguageBadge from '../../components/LanguageBadge'
import { readingPath } from '../../services/readingLanguage'
import CoverDropzone from '../../components/CoverDropzone'
import FollowListModal from '../../components/FollowListModal'
import AvatarLightbox from '../../components/AvatarLightbox'
import AuthorRecentChapters from '../../components/AuthorRecentChapters'
import SeoHead from '../../components/SeoHead'
import AgeRatingBadge from '../../components/AgeRatingBadge'
import AvatarWithFrame from '../../components/AvatarWithFrame'
import PremiumBadge from '../../components/PremiumBadge'
import PremiumPicker from '../../components/PremiumPicker'
import { useAuth } from '../../services/auth/AuthContext'
import { getAuthorProfile, toggleFollowAuthor, updateMyAuthorProfile } from '../../services/originals/api'
import { customizePremium } from '../../services/premium/api'
import type { PublicAuthorProfile, SocialLink } from '../../services/originals/types'
import type { PremiumSelectionValue } from '../../components/PremiumPicker'
import styles from './AuthorProfile.module.css'

interface LinkRow extends SocialLink {
  id: string
}

const MAX_LINKS = 6

export default function AuthorProfile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { username } = useParams<{ username: string }>()
  const { token, user: authUser, refreshUser } = useAuth()

  const [profile, setProfile] = useState<PublicAuthorProfile | null>(null)
  // Локальный "примерочный" оверрайд для не-Premium (см. PremiumPicker,
  // "может примерять, но не сохранять") — ничего не шлёт на бэкенд, просто
  // временно подменяет то, что видно на этой же странице до перезагрузки.
  const [premiumPreview, setPremiumPreview] = useState<PremiumSelectionValue | null>(null)
  const [premiumSaving, setPremiumSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [followListMode, setFollowListMode] = useState<'followers' | 'following' | null>(null)

  const [editing, setEditing] = useState(false)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [profileLinks, setProfileLinks] = useState<LinkRow[]>([])
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false)

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

  // Что реально применить сейчас: свой сохранённый выбор (см.
  // useAuth().user — там он приходит без гейтинга по активности, чтобы
  // владелец видел, что сохранено, даже пока Premium не активен) — а если
  // это не-Premium что-то "примерил" на этой странице, временный оверрайд
  // поверх него (см. premiumPreview выше).
  const premiumCurrent: PremiumSelectionValue = premiumPreview ?? {
    avatarFrame: authUser?.avatarFrame ?? null,
    accentColor: authUser?.accentColor ?? null,
  }

  async function handleCustomizePremium(patch: Partial<PremiumSelectionValue>) {
    if (!authUser?.isPremium) {
      setPremiumPreview({ ...premiumCurrent, ...patch })
      return
    }
    if (!token) return
    setPremiumSaving(true)
    try {
      const updated = await customizePremium(token, patch)
      setProfile((p) => (p ? { ...p, ...updated, isPremium: true } : p))
      await refreshUser()
    } catch {
      // тихо — поле просто не обновится, не критично для косметики
    } finally {
      setPremiumSaving(false)
    }
  }

  // Что реально нарисовано на странице: то, что сервер отдал как ПРИМЕНЯЕМОЕ
  // (profile.* — с гейтингом по активному Premium, см. publicPremiumFields на
  // бэкенде, для своего профиля тоже: истёкший Premium не применяется, хотя
  // выбор сохранён и виден в PremiumPicker выше) — либо временная "примерка"
  // не-Premium, которая живёт только до перезагрузки страницы.
  const applied: PremiumSelectionValue =
    profile?.isOwnProfile && premiumPreview
      ? premiumPreview
      : { avatarFrame: profile?.avatarFrame ?? null, accentColor: profile?.accentColor ?? null }

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
      <div
        className={`${styles.header} ${applied.avatarFrame ? styles.headerFramed : ''} ${applied.accentColor ? styles.headerAccent : ''}`}
        style={applied.accentColor ? { borderColor: applied.accentColor } : undefined}
      >
        {(() => {
          const avatarUrl = editing ? profileAvatarUrl : profile.avatarUrl
          const frame = applied.avatarFrame
          return (
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => avatarUrl && setAvatarLightboxOpen(true)}
              aria-label={t('author.viewAvatar') ?? ''}
              disabled={!avatarUrl}
            >
              <AvatarWithFrame avatarUrl={avatarUrl} name={profile.displayName} size={128} frame={frame} />
            </button>
          )
        })()}

        <h1 className={styles.name} style={applied.accentColor ? { color: applied.accentColor } : undefined}>
          {profile.displayName}
          {profile.isPremium && <PremiumBadge size={18} className={styles.nameBadge} />}
        </h1>
        <p className={styles.username}>@{profile.username}</p>

        <div className={styles.headerInfo}>
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

              <div className={styles.statsRow}>
                <span className={styles.statItem}>
                  <strong>{profile.totalReads}</strong>
                  <span>{t('author.reads')}</span>
                </span>
                <span className={styles.statItem}>
                  <strong>{profile.totalLikes}</strong>
                  <span>{t('author.likes')}</span>
                </span>
                <button type="button" className={styles.statItem} onClick={() => setFollowListMode('followers')}>
                  <strong>{profile.followersCount}</strong>
                  <span>{t('author.followers')}</span>
                </button>
                <button type="button" className={styles.statItem} onClick={() => setFollowListMode('following')}>
                  <strong>{profile.followingCount}</strong>
                  <span>{t('author.followingStat')}</span>
                </button>
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

              {profile.isOwnProfile && (
                <button type="button" className={styles.editButton} onClick={startEditing}>
                  <Pencil size={14} />
                  {t('creator.profile.edit')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {profile.isOwnProfile && !editing && (
        <PremiumPicker
          avatarUrl={profile.avatarUrl}
          name={profile.displayName}
          current={premiumCurrent}
          isPremium={!!authUser?.isPremium}
          saving={premiumSaving}
          onCustomize={handleCustomizePremium}
        />
      )}

      <AuthorRecentChapters chapters={profile.recentChapters} />

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
                <LanguageBadge
                  languages={m.languages}
                  primary={m.primaryLanguage}
                  onSelect={(lang) => navigate(readingPath(`/originals/${m.id}`, lang))}
                />
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

      {avatarLightboxOpen && (editing ? profileAvatarUrl : profile.avatarUrl) && (
        <AvatarLightbox
          src={(editing ? profileAvatarUrl : profile.avatarUrl)!}
          alt={profile.displayName}
          onClose={() => setAvatarLightboxOpen(false)}
        />
      )}
    </MainLayout>
  )
}
