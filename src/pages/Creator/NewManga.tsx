import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import RequireAuth from '../../components/RequireAuth'
import CoverDropzone from '../../components/CoverDropzone'
import { useAuth } from '../../services/auth/AuthContext'
import { createManga } from '../../services/originals/api'
import type { MangaContentType } from '../../services/originals/types'
import styles from './Creator.module.css'

const CONTENT_TYPES: MangaContentType[] = ['manga', 'manhwa', 'comic']

function NewMangaForm() {
  const { t } = useTranslation()
  const { token, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState<MangaContentType>('manga')
  const [genres, setGenres] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function addGenre() {
    const value = genreInput.trim()
    if (value && !genres.includes(value) && genres.length < 10) {
      setGenres((g) => [...g, value])
    }
    setGenreInput('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!agreed) {
      setError(t('creator.new.mustAgree'))
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const manga = await createManga(token!, {
        title,
        description,
        coverUrl: coverUrl ?? undefined,
        genres,
        contentType,
        agreedToRules: true,
      })
      // Это могла быть первая публикация пользователя — на бэкенде она
      // заодно создаёт AuthorProfile (см. getOrCreateAuthorProfile в
      // originals.ts). Без этого authorUsername в контексте оставался бы
      // null до следующего входа, и пункт меню "Мой профиль автора" не
      // появлялся сразу после публикации.
      refreshUser().catch(() => {})
      navigate(`/creator/${manga.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creator.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MainLayout>
      <form className={styles.formPage} onSubmit={handleSubmit}>
        <h1 className={styles.pageTitle}>{t('creator.new.title')}</h1>

        <div className={styles.formRow}>
          <div>
            <label className={styles.label} htmlFor="manga-title">
              {t('creator.new.titleLabel')}
            </label>
            <input
              id="manga-title"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={2}
              maxLength={200}
              required
            />

            <label className={styles.label} htmlFor="manga-description">
              {t('creator.new.descriptionLabel')}
            </label>
            <textarea
              id="manga-description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={10}
              maxLength={5000}
              rows={6}
              required
            />

            <label className={styles.label}>{t('creator.new.contentTypeLabel')}</label>
            <div className={styles.segmented}>
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct}
                  type="button"
                  className={contentType === ct ? styles.segmentActive : styles.segment}
                  onClick={() => setContentType(ct)}
                >
                  {t(`creator.contentType.${ct}`)}
                </button>
              ))}
            </div>

            <label className={styles.label} htmlFor="manga-genres">
              {t('creator.new.genresLabel')}
            </label>
            <div className={styles.genreInputRow}>
              <input
                id="manga-genres"
                className={styles.input}
                value={genreInput}
                onChange={(e) => setGenreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addGenre()
                  }
                }}
                placeholder={t('creator.new.genresPlaceholder') ?? ''}
              />
              <button type="button" className={styles.addGenreButton} onClick={addGenre}>
                {t('creator.new.addGenre')}
              </button>
            </div>
            {genres.length > 0 && (
              <div className={styles.genreList}>
                {genres.map((g) => (
                  <span key={g} className={styles.genreTag}>
                    {g}
                    <button type="button" onClick={() => setGenres((list) => list.filter((x) => x !== g))} aria-label="remove">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={styles.label}>{t('creator.new.coverLabel')}</label>
            <CoverDropzone value={coverUrl} onChange={setCoverUrl} />
          </div>
        </div>

        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            {t('creator.new.agreeText')} <Link to="/publishing-rules">{t('creator.new.agreeLink')}</Link>
          </span>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.primaryButton} disabled={submitting}>
          {submitting ? t('common.loading') : t('creator.new.submit')}
        </button>
      </form>
    </MainLayout>
  )
}

export default function NewManga() {
  return (
    <RequireAuth>
      <NewMangaForm />
    </RequireAuth>
  )
}
