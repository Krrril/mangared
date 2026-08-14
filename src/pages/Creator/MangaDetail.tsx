import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Send, Eye, Heart } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import RequireAuth from '../../components/RequireAuth'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import PagesDropzone from '../../components/PagesDropzone'
import { useAuth } from '../../services/auth/AuthContext'
import { addChapter, getMyManga, submitManga } from '../../services/originals/api'
import type { MyMangaDetail } from '../../services/originals/types'
import { formatCount } from '../../utils/formatCount'
import styles from './Creator.module.css'

function MangaDetailContent() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { mangaId } = useParams<{ mangaId: string }>()

  const [manga, setManga] = useState<MyMangaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showChapterForm, setShowChapterForm] = useState(false)

  const [chapterNumber, setChapterNumber] = useState('')
  const [chapterTitle, setChapterTitle] = useState('')
  const [pages, setPages] = useState<string[]>([])
  const [chapterError, setChapterError] = useState<string | null>(null)
  const [savingChapter, setSavingChapter] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)

  function reload() {
    if (!token || !mangaId) return
    getMyManga(token, mangaId)
      .then(setManga)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }

  useEffect(reload, [token, mangaId])

  async function handleAddChapter() {
    if (!token || !mangaId) return
    const number = Number.parseFloat(chapterNumber)
    if (Number.isNaN(number) || number <= 0) {
      setChapterError(t('creator.detail.invalidNumber'))
      return
    }
    if (pages.length === 0) {
      setChapterError(t('creator.detail.needPages'))
      return
    }

    setChapterError(null)
    setSavingChapter(true)
    try {
      await addChapter(token, mangaId, { number, title: chapterTitle || undefined, pages })
      setChapterNumber('')
      setChapterTitle('')
      setPages([])
      setShowChapterForm(false)
      reload()
    } catch (err) {
      setChapterError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSavingChapter(false)
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
          <span className={styles.statusBadge}>{t(`creator.status.${manga.status}`)}</span>
          <span className={styles.mangaCardStats}>
            <span title={t('stats.views') ?? ''}>
              <Eye size={13} /> {formatCount(manga.viewsCount)}
            </span>
            <span title={t('stats.favorites') ?? ''}>
              <Heart size={13} /> {formatCount(manga.favoritesCount)}
            </span>
          </span>
          <p className={styles.detailDescription}>{manga.description}</p>
        </div>
      </div>

      {manga.status === 'rejected' && <p className={styles.warningBox}>{t('creator.detail.rejectedNotice')}</p>}
      {manga.status === 'pending' && <p className={styles.infoBox}>{t('creator.detail.pendingNotice')}</p>}

      <div className={styles.headerRow}>
        <h2 className={styles.sectionHeading}>{t('creator.detail.chapters', { count: manga.chapters.length })}</h2>
        <button type="button" className={styles.primaryButtonSmall} onClick={() => setShowChapterForm((v) => !v)}>
          <Plus size={16} />
          {t('creator.detail.addChapter')}
        </button>
      </div>

      {showChapterForm && (
        <div className={styles.chapterForm}>
          <div className={styles.formRow}>
            <div>
              <label className={styles.label}>{t('creator.detail.chapterNumber')}</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                className={styles.input}
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.label}>{t('creator.detail.chapterTitleOptional')}</label>
              <input className={styles.input} value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} />
            </div>
          </div>

          <label className={styles.label}>{t('creator.detail.pagesLabel')}</label>
          <PagesDropzone onChange={setPages} />

          {chapterError && <p className={styles.error}>{chapterError}</p>}

          <button type="button" className={styles.primaryButton} onClick={handleAddChapter} disabled={savingChapter}>
            {savingChapter ? t('common.loading') : t('creator.detail.saveChapter')}
          </button>
        </div>
      )}

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

      {canSubmit && (
        <button type="button" className={styles.primaryButton} onClick={handleSubmitForReview} disabled={submittingReview}>
          <Send size={16} />
          {submittingReview ? t('common.loading') : t('creator.detail.submitForReview')}
        </button>
      )}
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
