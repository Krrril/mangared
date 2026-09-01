import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Send, Eye, Heart, X, Trash2, Pencil, Check } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import RequireAuth from '../../components/RequireAuth'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import PagesDropzone from '../../components/PagesDropzone'
import GenrePicker from '../../components/GenrePicker'
import AgeRatingBadge from '../../components/AgeRatingBadge'
import { useAuth } from '../../services/auth/AuthContext'
import { addChapter, deleteManga, getMyManga, submitManga, updateManga } from '../../services/originals/api'
import type { MyMangaDetail } from '../../services/originals/types'
import { formatCount } from '../../utils/formatCount'
import { AGE_RATINGS, type SelectableAgeRating } from '../../constants/ageRating'
import styles from './Creator.module.css'

interface ChapterDraft {
  id: string
  number: string
  title: string
  pages: string[]
  error: string | null
  saving: boolean
}

/** Следующий номер = на 1 больше максимума среди уже сохранённых глав и
 * ещё не сохранённых открытых форм — автор может поменять вручную (дробные
 * номера вроде 1.1 нужны для спецвыпусков). */
function nextChapterNumber(chapters: MyMangaDetail['chapters'], drafts: ChapterDraft[]): string {
  const known = [...chapters.map((c) => c.number), ...drafts.map((d) => Number.parseFloat(d.number)).filter((n) => !Number.isNaN(n))]
  return String(Math.max(0, ...known) + 1)
}

function MangaDetailContent() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { mangaId } = useParams<{ mangaId: string }>()
  const navigate = useNavigate()

  const [manga, setManga] = useState<MyMangaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ChapterDraft[]>([])
  const [submittingReview, setSubmittingReview] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [editingMeta, setEditingMeta] = useState(false)
  const [editGenres, setEditGenres] = useState<string[]>([])
  const [editAgeRating, setEditAgeRating] = useState<SelectableAgeRating | null>(null)
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)

  function reload() {
    if (!token || !mangaId) return
    getMyManga(token, mangaId)
      .then(setManga)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }

  useEffect(reload, [token, mangaId])

  // Несохранённые страницы в открытых формах теряются безвозвратно при
  // закрытии вкладки/переходе на другой сайт — предупреждаем через
  // стандартный диалог браузера (blocker в духе useBlocker тут не завести:
  // роутер приложения — обычный BrowserRouter, не data router).
  useEffect(() => {
    const hasUnsavedPages = drafts.some((d) => d.pages.length > 0)
    if (!hasUnsavedPages) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [drafts])

  function addDraftForm() {
    setDrafts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), number: manga ? nextChapterNumber(manga.chapters, prev) : '1', title: '', pages: [], error: null, saving: false },
    ])
  }

  function updateDraft(id: string, patch: Partial<Pick<ChapterDraft, 'number' | 'title'>>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function updateDraftPages(id: string, pages: string[]) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, pages } : d)))
  }

  function removeDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  async function handleSaveDraft(id: string) {
    if (!token || !mangaId) return
    const draft = drafts.find((d) => d.id === id)
    if (!draft) return

    const number = Number.parseFloat(draft.number)
    if (Number.isNaN(number) || number <= 0) {
      setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, error: t('creator.detail.invalidNumber') } : d)))
      return
    }
    if (draft.pages.length === 0) {
      setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, error: t('creator.detail.needPages') } : d)))
      return
    }

    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, error: null, saving: true } : d)))
    try {
      await addChapter(token, mangaId, { number, title: draft.title || undefined, pages: draft.pages })
      setDrafts((prev) => prev.filter((d) => d.id !== id))
      reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('creator.genericError')
      setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, error: message, saving: false } : d)))
    }
  }

  async function handleDeleteManga() {
    if (!token || !mangaId) return
    if (!window.confirm(t('creator.detail.deleteConfirm') ?? '')) return
    setDeleting(true)
    try {
      await deleteManga(token, mangaId)
      navigate('/creator')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creator.genericError'))
      setDeleting(false)
    }
  }

  function startEditingMeta() {
    if (!manga) return
    setEditGenres(manga.genres)
    setEditAgeRating(manga.ageRating === 'unrated' ? null : manga.ageRating)
    setMetaError(null)
    setEditingMeta(true)
  }

  async function handleSaveMeta() {
    if (!token || !mangaId) return
    if (editGenres.length === 0) {
      setMetaError(t('creator.new.needGenre'))
      return
    }
    setSavingMeta(true)
    setMetaError(null)
    try {
      await updateManga(token, mangaId, { genres: editGenres, ageRating: editAgeRating ?? undefined })
      setEditingMeta(false)
      reload()
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleSubmitForReview() {
    if (!token || !mangaId) return
    setSubmittingReview(true)
    setError(null)
    try {
      await submitManga(token, mangaId)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSubmittingReview(false)
    }
  }

  if (error) {
    return (
      <MainLayout>
        <p className={styles.error}>{error}</p>
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

  const canSubmit = manga.status === 'draft' || manga.status === 'rejected'

  return (
    <MainLayout>
      <div className={styles.detailHeader}>
        <CoverPlaceholder
          cover={{ from: '#2a2a3a', to: '#1a1a24' }}
          name={manga.title}
          imageUrl={manga.coverUrl ?? undefined}
          className={styles.detailCover}
        />
        <div>
          <h1 className={styles.pageTitle}>{manga.title}</h1>
          <span className={styles.statusBadge}>{t(`creator.status.${manga.status}`)}</span> <AgeRatingBadge rating={manga.ageRating} />
          <span className={styles.mangaCardStats}>
            <span title={t('stats.views') ?? ''}>
              <Eye size={13} /> {formatCount(manga.viewsCount)}
            </span>
            <span title={t('stats.favorites') ?? ''}>
              <Heart size={13} /> {formatCount(manga.favoritesCount)}
            </span>
          </span>
          <p className={styles.detailDescription}>{manga.description}</p>

          {editingMeta ? (
            <div className={styles.chapterForm}>
              <label className={styles.label}>{t('creator.new.genresLabel')}</label>
              <GenrePicker value={editGenres} onChange={setEditGenres} />
              <label className={styles.label}>{t('creator.new.ageRatingLabel')}</label>
              <div className={styles.segmented}>
                {AGE_RATINGS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={editAgeRating === r ? styles.segmentActive : styles.segment}
                    onClick={() => setEditAgeRating(r)}
                  >
                    {t(`ageRating.${r}`)}
                  </button>
                ))}
              </div>
              {metaError && <p className={styles.error}>{metaError}</p>}
              <div className={styles.headerRow}>
                <button type="button" className={styles.primaryButtonSmall} disabled={savingMeta} onClick={handleSaveMeta}>
                  <Check size={14} /> {savingMeta ? t('common.loading') : t('common.save')}
                </button>
                <button type="button" className={styles.primaryButtonSmall} onClick={() => setEditingMeta(false)}>
                  <X size={14} /> {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            canSubmit && (
              <button type="button" className={styles.primaryButtonSmall} onClick={startEditingMeta}>
                <Pencil size={14} /> {t('creator.detail.editGenresRating')}
              </button>
            )
          )}
        </div>
      </div>

      {manga.status === 'rejected' && <p className={styles.warningBox}>{t('creator.detail.rejectedNotice')}</p>}
      {manga.status === 'pending' && <p className={styles.infoBox}>{t('creator.detail.pendingNotice')}</p>}

      <div className={styles.headerRow}>
        <h2 className={styles.sectionHeading}>{t('creator.detail.chapters', { count: manga.chapters.length })}</h2>
        <button type="button" className={styles.primaryButtonSmall} onClick={addDraftForm}>
          <Plus size={16} />
          {t('creator.detail.addChapter')}
        </button>
      </div>

      {drafts.map((draft) => (
        <div key={draft.id} className={styles.chapterForm}>
          <button
            type="button"
            className={styles.removeDraftButton}
            onClick={() => removeDraft(draft.id)}
            aria-label={t('creator.detail.removeDraft') ?? ''}
          >
            <X size={14} />
          </button>

          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>{t('creator.detail.chapterNumber')}</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                className={styles.input}
                value={draft.number}
                onChange={(e) => updateDraft(draft.id, { number: e.target.value })}
              />
            </div>
            <div>
              <label className={styles.label}>{t('creator.detail.chapterTitleOptional')}</label>
              <input className={styles.input} value={draft.title} onChange={(e) => updateDraft(draft.id, { title: e.target.value })} />
            </div>
          </div>

          <label className={styles.label}>{t('creator.detail.pagesLabel')}</label>
          <PagesDropzone onChange={(pages) => updateDraftPages(draft.id, pages)} />

          {draft.error && <p className={styles.error}>{draft.error}</p>}

          <button type="button" className={styles.primaryButton} onClick={() => handleSaveDraft(draft.id)} disabled={draft.saving}>
            {draft.saving ? t('common.loading') : t('creator.detail.saveChapter')}
          </button>
        </div>
      ))}

      {manga.chapters.length > 0 && (
        <ul className={styles.chapterList}>
          {manga.chapters.map((c) => (
            <li key={c.id} className={styles.chapterRow}>
              <span>{t('common.chapter', { number: c.number })}</span>
              {c.title && <span className={styles.chapterTitleText}>{c.title}</span>}
              <span className={styles.chapterPageCount}>{t('creator.detail.pageCount', { count: c.pages.length })}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.headerRow}>
        {canSubmit && (
          <button type="button" className={styles.primaryButton} onClick={handleSubmitForReview} disabled={submittingReview}>
            <Send size={16} />
            {submittingReview ? t('common.loading') : t('creator.detail.submitForReview')}
          </button>
        )}
        <button type="button" className={styles.dangerButton} onClick={handleDeleteManga} disabled={deleting}>
          <Trash2 size={16} />
          {deleting ? t('common.loading') : t('creator.detail.deleteManga')}
        </button>
      </div>
    </MainLayout>
  )
}

export default function MangaDetail() {
  return (
    <RequireAuth>
      <MangaDetailContent />
    </RequireAuth>
  )
}
