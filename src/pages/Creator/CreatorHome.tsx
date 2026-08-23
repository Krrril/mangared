import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Eye, Heart, Users, MessageCircle, BookOpen, Pencil, X, Check } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import RequireAuth from '../../components/RequireAuth'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import CoverDropzone from '../../components/CoverDropzone'
import { useAuth } from '../../services/auth/AuthContext'
import { getMyAuthorProfile, getMyMangas, updateMyAuthorProfile } from '../../services/originals/api'
import type { AuthorSummary, MyManga, SocialLink } from '../../services/originals/types'
import { formatCount } from '../../utils/formatCount'
import styles from './Creator.module.css'

interface LinkRow extends SocialLink {
  id: string
}

const MAX_LINKS = 6

function statusClassName(status: MyManga['status']) {
  switch (status) {
    case 'published':
      return styles.statusPublished
    case 'pending':
      return styles.statusPending
    case 'rejected':
      return styles.statusRejected
    default:
      return styles.statusDraft
  }
}

function CreatorHomeContent() {
  const { t } = useTranslation()
  const { token, refreshUser } = useAuth()
  const [mangas, setMangas] = useState<MyManga[] | null>(null)
  const [author, setAuthor] = useState<AuthorSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [profileLinks, setProfileLinks] = useState<LinkRow[]>([])
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    getMyMangas(token)
      .then(setMangas)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
    getMyAuthorProfile(token).then(setAuthor).catch(() => {})
  }, [token])

  function startEditingProfile() {
    setProfileAvatarUrl(author?.avatarUrl ?? null)
    setProfileLinks((author?.socialLinks ?? []).map((l) => ({ id: crypto.randomUUID(), ...l })))
    setProfileError(null)
    setEditingProfile(true)
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
      setAuthor(updated)
      setEditingProfile(false)
      refreshUser()
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setProfileSaving(false)
    }
  }

  const totals =
    mangas && mangas.length > 0
      ? {
          works: mangas.length,
          published: mangas.filter((m) => m.status === 'published').length,
          views: mangas.reduce((sum, m) => sum + m.viewsCount, 0),
          likes: mangas.reduce((sum, m) => sum + m.favoritesCount, 0),
        }
      : null

  return (
    <MainLayout>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>{t('creator.home.title')}</h1>
        <Link to="/creator/new" className={styles.primaryButtonSmall}>
          <Plus size={16} />
          {t('creator.home.newWork')}
        </Link>
      </div>

      {totals && (
        <div className={styles.dashboardStats}>
          <div className={styles.dashboardTile}>
            <BookOpen size={18} />
            <span className={styles.dashboardValue}>{totals.published}</span>
            <span className={styles.dashboardLabel}>{t('creator.dashboard.published', { total: totals.works })}</span>
          </div>
          <div className={styles.dashboardTile}>
            <Eye size={18} />
            <span className={styles.dashboardValue}>{formatCount(totals.views)}</span>
            <span className={styles.dashboardLabel}>{t('stats.views')}</span>
          </div>
          <div className={styles.dashboardTile}>
            <Heart size={18} />
            <span className={styles.dashboardValue}>{formatCount(totals.likes)}</span>
            <span className={styles.dashboardLabel}>{t('stats.favorites')}</span>
          </div>
          <div className={styles.dashboardTile}>
            <Users size={18} />
            <span className={styles.dashboardValue}>{formatCount(author?.followersCount ?? 0)}</span>
            <span className={styles.dashboardLabel}>{t('creator.dashboard.followers')}</span>
          </div>
          <div className={`${styles.dashboardTile} ${styles.dashboardTileSoon}`} title={t('creator.dashboard.commentsSoonHint') ?? ''}>
            <MessageCircle size={18} />
            <span className={styles.dashboardValue}>—</span>
            <span className={styles.dashboardLabel}>{t('creator.dashboard.comments')}</span>
          </div>
        </div>
      )}

      {author && !editingProfile && (
        <button type="button" className={styles.editProfileToggle} onClick={startEditingProfile}>
          <Pencil size={14} />
          {t('creator.profile.edit')}
        </button>
      )}

      {editingProfile && (
        <div className={styles.editProfileForm}>
          <h2 className={styles.sectionHeading}>{t('creator.profile.edit')}</h2>

          <label className={styles.label}>{t('creator.profile.avatar')}</label>
          <CoverDropzone value={profileAvatarUrl} onChange={setProfileAvatarUrl} folder="avatars" />

          <label className={styles.label}>{t('creator.profile.links')}</label>
          <div className={styles.linkRows}>
            {profileLinks.map((link) => (
              <div key={link.id} className={styles.linkRow}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={t('creator.profile.linkLabelPlaceholder') ?? ''}
                  value={link.label}
                  maxLength={30}
                  onChange={(e) => updateLinkRow(link.id, { label: e.target.value })}
                />
                <input
                  type="text"
                  className={styles.input}
                  placeholder={t('creator.profile.linkUrlPlaceholder') ?? ''}
                  value={link.url}
                  onChange={(e) => updateLinkRow(link.id, { url: e.target.value })}
                />
                <button
                  type="button"
                  className={styles.removeDraftButton}
                  onClick={() => removeLinkRow(link.id)}
                  aria-label={t('creator.detail.removeDraft') ?? ''}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {profileLinks.length < MAX_LINKS && (
            <button type="button" className={styles.addGenreButton} onClick={addLinkRow}>
              <Plus size={14} />
              {t('creator.profile.addLink')}
            </button>
          )}

          {profileError && <p className={styles.error}>{profileError}</p>}

          <div className={styles.editProfileActions}>
            <button type="button" className={styles.primaryButton} onClick={handleSaveProfile} disabled={profileSaving}>
              <Check size={16} />
              {profileSaving ? t('common.loading') : t('creator.profile.save')}
            </button>
            <button type="button" className={styles.cancelButton} onClick={() => setEditingProfile(false)} disabled={profileSaving}>
              {t('creator.profile.cancel')}
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {!error && !mangas && <p className={styles.hint}>{t('common.loading')}</p>}

      {!error && mangas && mangas.length === 0 && <p className={styles.hint}>{t('creator.home.empty')}</p>}

      {mangas && mangas.length > 0 && (
        <div className={styles.mangaGrid}>
          {mangas.map((m) => (
            <Link key={m.id} to={`/creator/${m.id}`} className={styles.mangaCard}>
              <div className={styles.mangaCoverWrap}>
                <CoverPlaceholder
                  cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                  name={m.title}
                  imageUrl={m.coverUrl ?? undefined}
                  className={styles.mangaCover}
                />
                <span className={styles.addChapterOverlay}>
                  <Plus size={16} />
                  {t('creator.detail.addChapter')}
                </span>
              </div>
              <p className={styles.mangaCardTitle}>{m.title}</p>
              <span className={`${styles.statusBadge} ${statusClassName(m.status)}`}>{t(`creator.status.${m.status}`)}</span>
              <span className={styles.mangaCardMeta}>{t('creator.home.chaptersCount', { count: m.chaptersCount })}</span>
              <span className={styles.mangaCardStats}>
                <span title={t('stats.views') ?? ''}>
                  <Eye size={12} /> {formatCount(m.viewsCount)}
                </span>
                <span title={t('stats.favorites') ?? ''}>
                  <Heart size={12} /> {formatCount(m.favoritesCount)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </MainLayout>
  )
}

export default function CreatorHome() {
  return (
    <RequireAuth>
      <CreatorHomeContent />
    </RequireAuth>
  )
}
