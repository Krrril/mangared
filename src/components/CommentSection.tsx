import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Flag, MessageSquare, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth/AuthContext'
import { deleteComment, getComments, postComment, reportComment } from '../services/comments/api'
import type { CommentEntry } from '../services/comments/api'
import styles from './CommentSection.module.css'

interface Props {
  mangaId: string
  /** Отсутствует — комментарии под тайтлом целиком; задан — под конкретной главой (см. задачу). Один и тот же компонент для обоих мест. */
  chapterId?: string
}

const MAX_LENGTH = 2000

export default function CommentSection({ mangaId, chapterId }: Props) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [comments, setComments] = useState<CommentEntry[] | null>(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Идентификаторы уже отправленных этой сессией жалоб — только чтобы
  // задизейблить кнопку и не дать нажать повторно; источник истины всё
  // равно бэкенд (повторная жалоба идемпотентна, см. routes/comments.ts).
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set())

  function reload() {
    getComments(mangaId, chapterId, token).then(setComments)
  }

  useEffect(reload, [mangaId, chapterId, token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    const trimmed = text.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)
    try {
      const created = await postComment(token, mangaId, trimmed, chapterId)
      setComments((prev) => [created, ...(prev ?? [])])
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('comments.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!token) return
    if (!window.confirm(t('comments.deleteConfirm') ?? '')) return
    await deleteComment(token, id).catch(() => {})
    setComments((prev) => prev?.filter((c) => c.id !== id) ?? null)
  }

  async function handleReport(id: string) {
    if (!token) return
    await reportComment(token, id).catch(() => {})
    setReportedIds((prev) => new Set(prev).add(id))
  }

  return (
    <section className={styles.wrap}>
      <h2 className={styles.heading}>
        <MessageSquare size={16} />
        {t('comments.heading', { count: comments?.length ?? 0 })}
      </h2>

      {token ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('comments.placeholder') ?? ''}
            maxLength={MAX_LENGTH}
            rows={3}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submitButton} disabled={submitting || !text.trim()}>
            {submitting ? t('common.loading') : t('comments.submit')}
          </button>
        </form>
      ) : (
        <p className={styles.loginHint}>
          <Link to="/auth">{t('comments.loginToComment')}</Link>
        </p>
      )}

      {!comments ? (
        <p className={styles.hint}>{t('common.loading')}</p>
      ) : comments.length === 0 ? (
        <p className={styles.hint}>{t('comments.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((c) => (
            <li key={c.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.avatar}>
                  {c.author.avatarUrl ? (
                    <img src={c.author.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{c.author.name.charAt(0).toUpperCase()}</span>
                  )}
                </span>
                {c.author.username ? (
                  <Link to={`/author/${c.author.username}`} className={styles.authorName}>
                    {c.author.name}
                  </Link>
                ) : (
                  <span className={styles.authorName}>{c.author.name}</span>
                )}
                <span className={styles.time}>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className={styles.text}>{c.text}</p>
              <div className={styles.actions}>
                {c.mine ? (
                  <button type="button" className={styles.actionButton} onClick={() => handleDelete(c.id)}>
                    <Trash2 size={13} /> {t('comments.delete')}
                  </button>
                ) : (
                  token && (
                    <button
                      type="button"
                      className={styles.actionButton}
                      disabled={reportedIds.has(c.id)}
                      onClick={() => handleReport(c.id)}
                    >
                      <Flag size={13} /> {reportedIds.has(c.id) ? t('comments.reported') : t('comments.report')}
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
