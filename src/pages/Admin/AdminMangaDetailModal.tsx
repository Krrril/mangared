import { useEffect, useState } from 'react'
import { X, Check, Trash2 } from 'lucide-react'
import { fetchAdminMangaDetail, type AdminMangaDetail } from '../../services/admin/api'
import styles from './Admin.module.css'

interface Props {
  mangaId: string
  token: string
  onClose: () => void
  /** Кнопки Approve/Reject — показываем только когда открыто со вкладки "Moderation" (тайтл ещё pending). */
  onApprove?: () => void
  onReject?: () => void
  actingOn?: boolean
}

/**
 * Детальный просмотр тайтла для модерации — все главы целиком (число
 * страниц + миниатюры самих изображений), без перехода на публичную
 * страницу чтения (которая для pending/rejected тайтлов и не сработала бы
 * для обычного посетителя — см. optionalAuth в routes/originals.ts).
 */
export default function AdminMangaDetailModal({ mangaId, token, onClose, onApprove, onReject, actingOn }: Props) {
  const [manga, setManga] = useState<AdminMangaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openChapterId, setOpenChapterId] = useState<string | null>(null)

  useEffect(() => {
    fetchAdminMangaDetail(token, mangaId)
      .then((m) => {
        setManga(m)
        setOpenChapterId(m.chapters[0]?.id ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [token, mangaId])

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="close">
          <X size={18} />
        </button>

        {error && <div className={styles.state}>{error}</div>}
        {!error && !manga && <div className={styles.state}>Loading…</div>}

        {manga && (
          <>
            <div className={styles.modalHeader}>
              {manga.coverUrl && <img src={manga.coverUrl} alt={manga.title} className={styles.modalCover} />}
              <div>
                <h2 className={styles.modalTitle}>{manga.title}</h2>
                <p className={styles.moderationMeta}>
                  by {manga.author.displayName} (@{manga.author.username}) · {manga.contentType} ·{' '}
                  <span className={styles.badge}>{manga.status}</span>
                </p>
                {manga.genres.length > 0 && (
                  <div className={styles.moderationGenres}>
                    {manga.genres.map((g) => (
                      <span key={g} className={styles.badge}>
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                <p className={styles.modalDescription}>{manga.description}</p>
              </div>
            </div>

            <h3 className={styles.modalSectionTitle}>Chapters ({manga.chapters.length})</h3>

            {manga.chapters.length === 0 && <p className={styles.moderationMeta}>No chapters uploaded yet.</p>}

            <div className={styles.modalChapterList}>
              {manga.chapters.map((c) => (
                <div key={c.id} className={styles.modalChapter}>
                  <button
                    type="button"
                    className={styles.modalChapterHeader}
                    onClick={() => setOpenChapterId((cur) => (cur === c.id ? null : c.id))}
                  >
                    <span>
                      Chapter {c.number}
                      {c.title ? ` — ${c.title}` : ''}
                    </span>
                    <span className={styles.moderationMeta}>{c.pages.length} pages</span>
                  </button>
                  {openChapterId === c.id && (
                    <div className={styles.modalThumbGrid}>
                      {c.pages.map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={styles.modalThumbLink}>
                          <img src={url} alt={`Page ${i + 1}`} loading="lazy" className={styles.modalThumb} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(onApprove || onReject) && (
              <div className={`${styles.moderationActions} ${styles.modalActions}`}>
                {onApprove && (
                  <button type="button" className={styles.approveButton} disabled={actingOn} onClick={onApprove}>
                    <Check size={14} />
                    Approve
                  </button>
                )}
                {onReject && (
                  <button type="button" className={styles.rejectButton} disabled={actingOn} onClick={onReject}>
                    <Trash2 size={14} />
                    Reject
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
