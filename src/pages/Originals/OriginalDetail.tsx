import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Heart, Eye, Pencil, Trash2, X, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import CoverDropzone from '../../components/CoverDropzone'
import { getPublicManga } from '../../services/originals/api'
import type { PublicMangaDetail } from '../../services/originals/types'
import { isFavorite, toggleFavorite } from '../../services/favorites'
import { getStoredToken } from '../../services/auth/token'
import { useAuth } from '../../services/auth/AuthContext'
import { deleteAdminChapter, deleteAdminManga, updateAdminManga } from '../../services/admin/api'
import { formatCount } from '../../utils/formatCount'
import styles from './Originals.module.css'

export default function OriginalDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { mangaId } = useParams<{ mangaId: string }>()
  const { user, token } = useAuth()
  const [manga, setManga] = useState<PublicMangaDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [favorite, setFavorite] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editGenres, setEditGenres] = useState('')
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)

  const isAdminView = !!user?.isAdmin
  const isOwnerView = !!manga && !!user?.authorUsername && user.authorUsername === manga.author.username

  function reload() {
    if (!mangaId) return
    getPublicManga(mangaId)
      .then(setManga)
      .catch(() => setNotFound(true))
  }

  useEffect(() => {
    reload()
    if (mangaId) isFavorite(mangaId).then(setFavorite)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mangaId])

  const handleToggleFavorite = () => {
    if (!mangaId) return
    // См. тот же комментарий в TitlePage.tsx — гостевое избранное не
    // трогает счётчик на бэкенде, оптимистичный +1 только для вошедших.
    const isLoggedIn = !!getStoredToken()
    toggleFavorite(mangaId).then((newValue) => {
      setFavorite(newValue)
      if (isLoggedIn) {
        setManga((prev) => (prev ? { ...prev, favoritesCount: Math.max(0, prev.favoritesCount + (newValue ? 1 : -1)) } : prev))
      }
    })
  }

  function startEditing() {
    if (!manga) return
    setEditTitle(manga.title)
    setEditDescription(manga.description)
    setEditGenres(manga.genres.join(', '))
    setEditCoverUrl(manga.coverUrl)
    setAdminError(null)
    setEditing(true)
  }

  async function handleSaveEdit() {
    if (!token || !manga) return
    setSaving(true)
    setAdminError(null)
    try {
      await updateAdminManga(token, manga.id, {
        title: editTitle,
        description: editDescription,
        genres: editGenres
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean),
        coverUrl: editCoverUrl ?? undefined,
      })
      setEditing(false)
      reload()
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteManga() {
    if (!token || !manga) return
    if (!window.confirm(`Удалить тайтл «${manga.title}» целиком, со всеми ${manga.chapters.length} главами? Это необратимо.`)) return
    try {
      await deleteAdminManga(token, manga.id)
      navigate('/admin')
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : t('creator.genericError'))
    }
  }

  async function handleDeleteChapter(chapterId: string, chapterNumber: number) {
    if (!token) return
    if (!window.confirm(`Удалить главу ${chapterNumber}? Это необратимо.`)) return
    try {
      await deleteAdminChapter(token, chapterId)
      reload()
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : t('creator.genericError'))
    }
  }

  if (notFound) {
    return (
      <MainLayout>
        <p className={styles.hint}>{t('originals.notFound')}</p>
      </MainLayout>
    )
  }

  if (!manga) {
    return (
      <MainLayout>
        <p className={styles.hint}>{t('common.loading')}</p>
      </MainLayout>
    )
  }

  const firstChapter = manga.chapters[0]

  return (
    <MainLayout>
      {isAdminView && manga.status !== 'published' && (
        <p className={styles.adminPreviewBanner}>
          Админ-превью — этот тайтл имеет статус «{t(`creator.status.${manga.status}`)}» и не виден обычным читателям.
        </p>
      )}
      {adminError && <p className={styles.adminError}>{adminError}</p>}

      <div className={styles.detailHeader}>
        {editing ? (
          <CoverDropzone value={editCoverUrl} onChange={setEditCoverUrl} />
        ) : (
          <CoverPlaceholder
            cover={{ from: '#2a2a3a', to: '#1a1a24' }}
            name={manga.title}
            imageUrl={manga.coverUrl ?? undefined}
            className={styles.detailCover}
          />
        )}
        <div className={styles.detailInfo}>
          <span className={styles.originalBadge}>{t('originals.badge')}</span>

          {editing ? (
            <div className={styles.adminEditForm}>
              <input
                type="text"
                className={styles.adminEditInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t('creator.new.titleLabel') ?? ''}
              />
              <textarea
                className={styles.adminEditTextarea}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('creator.new.descriptionLabel') ?? ''}
              />
              <input
                type="text"
                className={styles.adminEditInput}
                value={editGenres}
                onChange={(e) => setEditGenres(e.target.value)}
                placeholder="Жанры через запятую"
              />
              <div className={styles.adminEditActions}>
                <button type="button" className={styles.adminSaveButton} disabled={saving} onClick={handleSaveEdit}>
                  <Check size={14} /> Сохранить
                </button>
                <button type="button" className={styles.adminCancelButton} onClick={() => setEditing(false)}>
                  <X size={14} /> Отмена
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className={styles.name}>{manga.title}</h1>
              <Link to={`/author/${manga.author.username}`} className={styles.authorLink}>
                {manga.author.displayName}
              </Link>
              <div className={styles.tags}>
                <span className={styles.pill}>{t(`creator.contentType.${manga.contentType}`)}</span>
                {manga.genres.map((g) => (
                  <span key={g} className={styles.pill}>
                    {g}
                  </span>
                ))}
                {manga.viewsCount > 0 && (
                  <span className={styles.pill} title={t('stats.views') ?? ''}>
                    <Eye size={13} /> {formatCount(manga.viewsCount)}
                  </span>
                )}
              </div>
              <p className={styles.description}>{manga.description}</p>
            </>
          )}

          <div className={styles.actionsRow}>
            {!editing && firstChapter && (
              <Link to={`/originals/${manga.id}/read/${firstChapter.id}`} className={styles.readButton}>
                {t('common.read')}
              </Link>
            )}
            {!editing && isOwnerView && (
              <Link to={`/creator/${manga.id}`} className={styles.adminToolButton}>
                <Pencil size={14} /> {t('originals.editButton')}
              </Link>
            )}
            {!editing && (
              <div className={styles.favoriteWrap}>
                <button
                  type="button"
                  className={`${styles.favoriteButton} ${favorite ? styles.favoriteButtonActive : ''}`}
                  aria-label="favorite"
                  aria-pressed={favorite}
                  onClick={handleToggleFavorite}
                >
                  <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
                </button>
                {manga.favoritesCount > 0 && (
                  <span className={styles.favoriteCount} title={t('stats.favorites') ?? ''}>
                    {formatCount(manga.favoritesCount)}
                  </span>
                )}
              </div>
            )}
            {isAdminView && !editing && (
              <>
                <button type="button" className={styles.adminToolButton} onClick={startEditing}>
                  <Pencil size={14} /> Редактировать
                </button>
                <button type="button" className={styles.adminDangerButton} onClick={handleDeleteManga}>
                  <Trash2 size={14} /> Удалить тайтл
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>{t('creator.detail.chapters', { count: manga.chapters.length })}</h2>

      <div className={styles.chapterList}>
        {manga.chapters.map((c) => (
          <div key={c.id} className={styles.chapterRowWrap}>
            <Link to={`/originals/${manga.id}/read/${c.id}`} className={styles.chapterRow}>
              <span>{t('common.chapter', { number: c.number })}</span>
              {c.title && <span className={styles.chapterTitleText}>{c.title}</span>}
              <span className={styles.chapterDate}>{new Date(c.publishedAt).toLocaleDateString()}</span>
            </Link>
            {isAdminView && (
              <button
                type="button"
                className={styles.adminChapterDelete}
                aria-label="delete chapter"
                onClick={() => handleDeleteChapter(c.id, c.number)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </MainLayout>
  )
}
