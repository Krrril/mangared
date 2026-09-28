import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Send, Eye, Heart, X, Trash2, Pencil, Check, Images, ImageUp } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import RequireAuth from '../../components/RequireAuth'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import CoverDropzone from '../../components/CoverDropzone'
import PagesDropzone from '../../components/PagesDropzone'
import GenreRatingFields from '../../components/GenreRatingFields'
import AgeRatingBadge from '../../components/AgeRatingBadge'
import LanguageFlag from '../../components/LanguageFlag'
import LanguagePicker from '../../components/LanguagePicker'
import { CONTENT_LANGUAGES, languageName, sortLanguages } from '../../constants/languages'
import { useAuth } from '../../services/auth/AuthContext'
import {
  addChapter,
  addChapterTranslation,
  deleteChapterTranslation,
  deleteManga,
  getMyManga,
  requestCoverChange,
  submitManga,
  updateChapterPages,
  updateChapterTranslationPages,
  updateMangaClassification,
} from '../../services/originals/api'
import type { MyMangaDetail } from '../../services/originals/types'
import { formatCount } from '../../utils/formatCount'
import { CURATED_GENRES } from '../../constants/genres'
import type { SelectableAgeRating } from '../../constants/ageRating'
import styles from './Creator.module.css'

function genreLabel(slug: string, t: (key: string) => string): string {
  const genre = CURATED_GENRES.find((g) => g.slug === slug)
  return genre ? t(`genres.${genre.id}`) : slug
}

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
  const { t, i18n } = useTranslation()
  const uiLang = i18n.resolvedLanguage ?? i18n.language
  const { token } = useAuth()
  const { mangaId } = useParams<{ mangaId: string }>()
  const navigate = useNavigate()

  const [manga, setManga] = useState<MyMangaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ChapterDraft[]>([])
  const [submittingReview, setSubmittingReview] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Предложить новую обложку опубликованного тайтла — уходит на повторную
  // модерацию, не применяется сразу (см. задачу). uploadingCover — сама
  // форма загрузки открыта/закрыта, submittingCoverRequest — идёт запрос
  // POST /cover-request после того, как файл уже загрузился в R2.
  const [uploadingCover, setUploadingCover] = useState(false)
  const [submittingCoverRequest, setSubmittingCoverRequest] = useState(false)
  const [coverRequestError, setCoverRequestError] = useState<string | null>(null)

  const [editingMeta, setEditingMeta] = useState(false)
  const [editGenres, setEditGenres] = useState<string[]>([])
  const [editAgeRating, setEditAgeRating] = useState<SelectableAgeRating | null>(null)
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Точечная правка страниц уже сохранённой главы (см. PagesDropzone.tsx,
  // initialPages) — по одной главе за раз, editingChapterId === null,
  // когда ни одна не открыта.
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  // Какая языковая версия главы сейчас правится (основная = primaryLanguage тайтла).
  const [editingLang, setEditingLang] = useState<string>('')
  // Форма "Добавить язык" — по одной главе за раз.
  const [addingLangChapterId, setAddingLangChapterId] = useState<string | null>(null)
  const [newLang, setNewLang] = useState<string | null>(null)
  const [newLangPages, setNewLangPages] = useState<string[]>([])
  const [savingNewLang, setSavingNewLang] = useState(false)
  const [newLangError, setNewLangError] = useState<string | null>(null)
  const [editingChapterPages, setEditingChapterPages] = useState<string[]>([])
  // Кастомная миниатюра для ленты "Последние главы" на профиле автора (см.
  // AuthorRecentChapters.tsx) — null здесь означает "нет своей, использовать
  // первую страницу", то же самое значение, что бэкенд трактует как дефолт.
  const [editingChapterThumbnail, setEditingChapterThumbnail] = useState<string | null>(null)
  const [savingChapterPages, setSavingChapterPages] = useState(false)
  const [chapterPagesError, setChapterPagesError] = useState<string | null>(null)

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
    if (!editAgeRating) {
      setMetaError(t('creator.new.needAgeRating'))
      return
    }
    setSavingMeta(true)
    setMetaError(null)
    try {
      // Отдельный от остальных полей эндпоинт — жанры/рейтинг можно менять
      // независимо от статуса тайтла (черновик/на модерации/опубликован/
      // отклонён), в отличие от title/description/cover (см. routes/originals.ts).
      await updateMangaClassification(token, mangaId, { genres: editGenres, ageRating: editAgeRating })
      setEditingMeta(false)
      reload()
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSavingMeta(false)
    }
  }

  function pagesForLanguage(chapter: MyMangaDetail['chapters'][number], language: string): string[] {
    if (manga && language === manga.primaryLanguage) return chapter.pages
    return chapter.translations.find((tr) => tr.language === language)?.pages ?? []
  }

  function startEditingChapterPages(chapter: MyMangaDetail['chapters'][number], language: string) {
    setAddingLangChapterId(null)
    setEditingChapterId(chapter.id)
    setEditingLang(language)
    setEditingChapterPages(pagesForLanguage(chapter, language))
    setEditingChapterThumbnail(chapter.feedThumbnailUrl)
    setChapterPagesError(null)
  }

  function startAddingLanguage(chapterId: string) {
    setEditingChapterId(null)
    setAddingLangChapterId(chapterId)
    setNewLang(null)
    setNewLangPages([])
    setNewLangError(null)
  }

  async function handleSaveNewLanguage(chapterId: string) {
    if (!token || !mangaId) return
    if (!newLang) {
      setNewLangError(t('creator.detail.needLanguage'))
      return
    }
    if (newLangPages.length === 0) {
      setNewLangError(t('creator.detail.needPages'))
      return
    }
    setSavingNewLang(true)
    setNewLangError(null)
    try {
      await addChapterTranslation(token, mangaId, chapterId, newLang, newLangPages)
      setAddingLangChapterId(null)
      reload()
    } catch (err) {
      setNewLangError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSavingNewLang(false)
    }
  }

  async function handleDeleteLanguageVersion(chapter: MyMangaDetail['chapters'][number], language: string) {
    if (!token || !mangaId) return
    if (!window.confirm(t('creator.detail.deleteLanguageConfirm', { language: languageName(language, uiLang), number: chapter.number }) ?? '')) return
    try {
      await deleteChapterTranslation(token, mangaId, chapter.id, language)
      setEditingChapterId(null)
      reload()
    } catch (err) {
      setChapterPagesError(err instanceof Error ? err.message : t('creator.genericError'))
    }
  }

  async function handleSaveChapterPages() {
    if (!token || !mangaId || !editingChapterId) return
    if (editingChapterPages.length === 0) {
      setChapterPagesError(t('creator.detail.needPages'))
      return
    }
    setSavingChapterPages(true)
    setChapterPagesError(null)
    try {
      if (manga && editingLang !== manga.primaryLanguage) {
        await updateChapterTranslationPages(token, mangaId, editingChapterId, editingLang, editingChapterPages)
      } else {
        await updateChapterPages(token, mangaId, editingChapterId, editingChapterPages, editingChapterThumbnail)
      }
      setEditingChapterId(null)
      reload()
    } catch (err) {
      setChapterPagesError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSavingChapterPages(false)
    }
  }

  async function handleProposeCover(newCoverUrl: string) {
    if (!token || !mangaId) return
    setSubmittingCoverRequest(true)
    setCoverRequestError(null)
    try {
      await requestCoverChange(token, mangaId, newCoverUrl)
      setUploadingCover(false)
      reload()
    } catch (err) {
      setCoverRequestError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSubmittingCoverRequest(false)
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
  // Языки тайтла = основной + языки, которые есть у его глав.
  const titleLanguages = [
    manga.primaryLanguage,
    ...sortLanguages(manga.chapters.flatMap((c) => c.translations.map((tr) => tr.language))).filter((l) => l !== manga.primaryLanguage),
  ]

  return (
    <MainLayout>
      <div className={styles.detailHeader}>
        <div className={styles.detailCoverCol}>
          <CoverPlaceholder
            cover={{ from: '#2a2a3a', to: '#1a1a24' }}
            name={manga.title}
            imageUrl={manga.coverUrl ?? undefined}
            className={styles.detailCover}
          />

          {manga.status === 'published' && (
            <div className={styles.coverRequestBox}>
              {manga.latestCoverRequest?.status === 'pending' ? (
                <p className={styles.coverRequestPending}>{t('creator.detail.coverPending')}</p>
              ) : (
                <>
                  {manga.latestCoverRequest?.status === 'rejected' && (
                    <p className={styles.coverRequestRejected}>{t('creator.detail.coverRejected')}</p>
                  )}
                  {uploadingCover ? (
                    <>
                      <CoverDropzone value={null} onChange={(url) => url && handleProposeCover(url)} />
                      {submittingCoverRequest && <p className={styles.hint}>{t('common.loading')}</p>}
                      {coverRequestError && <p className={styles.error}>{coverRequestError}</p>}
                      <button
                        type="button"
                        className={styles.primaryButtonSmall}
                        onClick={() => {
                          setUploadingCover(false)
                          setCoverRequestError(null)
                        }}
                      >
                        <X size={14} /> {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <button type="button" className={styles.primaryButtonSmall} onClick={() => setUploadingCover(true)}>
                      <ImageUp size={14} /> {t('creator.detail.proposeNewCover')}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
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

          <div className={styles.langRow}>
            <span className={styles.langRowLabel}>{t('creator.detail.languagesLabel')}</span>
            {titleLanguages.map((code) => (
              <span key={code} className={styles.langChipStatic}>
                <LanguageFlag code={code} size={16} />
                {languageName(code, uiLang)}
                {code === manga.primaryLanguage && <span className={styles.langChipTag}>{t('creator.detail.primaryTag')}</span>}
              </span>
            ))}
          </div>

          {editingMeta ? (
            <div className={styles.chapterForm}>
              <GenreRatingFields
                genres={editGenres}
                onGenresChange={setEditGenres}
                ageRating={editAgeRating}
                onAgeRatingChange={setEditAgeRating}
              />
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
            <>
              {manga.genres.length > 0 && (
                <div className={styles.genreList}>
                  {manga.genres.map((g) => (
                    <span key={g} className={styles.genreTag}>
                      {genreLabel(g, t)}
                    </span>
                  ))}
                </div>
              )}
              <button type="button" className={styles.primaryButtonSmall} onClick={startEditingMeta}>
                <Pencil size={14} /> {t('creator.detail.editGenresRating')}
              </button>
            </>
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
            <li key={c.id}>
              <div className={styles.chapterRow}>
                <span>{t('common.chapter', { number: c.number })}</span>
                {c.title && <span className={styles.chapterTitleText}>{c.title}</span>}
                <span className={styles.chapterPageCount}>{t('creator.detail.pageCount', { count: c.pages.length })}</span>
                {editingChapterId !== c.id && (
                  <button type="button" className={styles.chapterManageButton} onClick={() => startEditingChapterPages(c, manga.primaryLanguage)}>
                    <Images size={14} /> {t('creator.detail.managePages')}
                  </button>
                )}
              </div>

              <div className={styles.langRow}>
                {[manga.primaryLanguage, ...c.translations.map((tr) => tr.language)].map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`${styles.langChip} ${editingChapterId === c.id && editingLang === code ? styles.langChipActive : ''}`}
                    onClick={() => startEditingChapterPages(c, code)}
                    title={t('creator.detail.managePages') ?? ''}
                  >
                    <LanguageFlag code={code} size={16} />
                    {languageName(code, uiLang)}
                    <span className={styles.langChipTag}>{pagesForLanguage(c, code).length}</span>
                  </button>
                ))}
                {addingLangChapterId !== c.id && CONTENT_LANGUAGES.length > 1 + c.translations.length && (
                  <button type="button" className={styles.addLangButton} onClick={() => startAddingLanguage(c.id)}>
                    <Plus size={14} /> {t('creator.detail.addLanguage')}
                  </button>
                )}
              </div>

              {addingLangChapterId === c.id && (
                <div className={styles.chapterForm}>
                  <button
                    type="button"
                    className={styles.removeDraftButton}
                    onClick={() => setAddingLangChapterId(null)}
                    aria-label={t('common.cancel') ?? ''}
                  >
                    <X size={14} />
                  </button>
                  <p className={styles.hint}>{t('creator.detail.addLanguageHint', { number: c.number })}</p>
                  <label className={styles.label}>{t('creator.detail.newLanguageLabel')}</label>
                  <LanguagePicker
                    options={CONTENT_LANGUAGES.filter((l) => l !== manga.primaryLanguage && !c.translations.some((tr) => tr.language === l))}
                    value={newLang}
                    onChange={setNewLang}
                    ariaLabel={t('creator.detail.newLanguageLabel') ?? ''}
                  />
                  <label className={styles.label}>{t('creator.detail.pagesLabel')}</label>
                  <PagesDropzone key={`new-${c.id}`} onChange={setNewLangPages} />
                  {newLangError && <p className={styles.error}>{newLangError}</p>}
                  <button type="button" className={styles.primaryButton} disabled={savingNewLang} onClick={() => handleSaveNewLanguage(c.id)}>
                    {savingNewLang ? t('common.loading') : t('creator.detail.saveLanguageVersion')}
                  </button>
                </div>
              )}

              {editingChapterId === c.id && (
                <div className={styles.chapterForm}>
                  <p className={styles.langManaging}>
                    <LanguageFlag code={editingLang} size={18} />
                    {t('creator.detail.managingLanguage', { language: languageName(editingLang, uiLang) })}
                  </p>
                  {editingLang === manga.primaryLanguage && (
                    <>
                      <label className={styles.label}>{t('creator.detail.feedThumbnailLabel')}</label>
                      <p className={styles.hint}>{t('creator.detail.feedThumbnailHint')}</p>
                      <CoverDropzone value={editingChapterThumbnail} onChange={setEditingChapterThumbnail} />
                    </>
                  )}

                  <label className={styles.label}>{t('creator.detail.managePagesHint')}</label>
                  <PagesDropzone key={`${c.id}-${editingLang}`} initialPages={pagesForLanguage(c, editingLang)} onChange={setEditingChapterPages} />
                  {chapterPagesError && <p className={styles.error}>{chapterPagesError}</p>}
                  <div className={styles.headerRow}>
                    <button
                      type="button"
                      className={styles.primaryButtonSmall}
                      disabled={savingChapterPages}
                      onClick={handleSaveChapterPages}
                    >
                      <Check size={14} /> {savingChapterPages ? t('common.loading') : t('common.save')}
                    </button>
                    <button type="button" className={styles.primaryButtonSmall} onClick={() => setEditingChapterId(null)}>
                      <X size={14} /> {t('common.cancel')}
                    </button>
                    {editingLang !== manga.primaryLanguage && (
                      <button type="button" className={styles.dangerButton} onClick={() => handleDeleteLanguageVersion(c, editingLang)}>
                        <Trash2 size={14} /> {t('creator.detail.deleteLanguageVersion')}
                      </button>
                    )}
                  </div>
                </div>
              )}
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
