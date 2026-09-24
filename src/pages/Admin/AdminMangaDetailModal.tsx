import { useEffect, useState } from 'react'
import { X, Check, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchAdminMangaDetail, type AdminMangaDetail } from '../../services/admin/api'
import AgeRatingBadge from '../../components/AgeRatingBadge'
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
  const { t } = useTranslation()
  const [manga, setManga] = useState<AdminMangaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openChapterId, setOpenChapterId] = useState<string | null>(null)

  useEffect(() => {
    fetchAdminMangaDetail(token, mangaId)
      .then((m) => {
        setManga(m)
        setOpenChapterId(m.chapters[0]?.id ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('common.loadFailed')))
  }, [token, mangaId])

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label={t('a11y.close') ?? ''}>
          <X size={18} />
        </button>

        {error && <div className={styles.state}>{error}</div>}
        {!error && !manga && <div className={styles.state}>{t('common.loading')}</div>}

        {manga && (
          <>
            <div className={styles.modalHeader}>
              {manga.coverUrl && <img src={manga.coverUrl} alt={manga.title} className={styles.modalCover} />}
              <div>
                <h2 className={styles.modalTitle}>{manga.title}</h2>
                <p className={styles.moderationMeta}>
                  {t('admin.byAuthorHandle', { name: manga.author.displayName, username: manga.author.username, type: t(`creator.contentType.${manga.contentType}`) })}{' '}
                  <span className={styles.badge}>{t(`creator.status.${manga.status}`)}</span> <AgeRatingBadge rating={manga.ageRating} />
                </p>
                {manga.ageRating === 'unrated' && (
                  <p className={styles.moderationMeta}>
                    {t('admin.ageRatingNotSet')}
                  </p>
                )}
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

            <h3 className={styles.modalSectionTitle}>{t('admin.chaptersHeading', { count: manga.chapters.length })}</h3>

            {manga.chapters.length === 0 && <p className={styles.moderationMeta}>{t('admin.noChaptersYet')}</p>}

            <div className={styles.modalChapterList}>
              {manga.chapters.map((c) => (
                <div key={c.id} className={styles.modalChapter}>
                  <button
                    type="button"
                    className={styles.modalChapterHeader}
                    onClick={() => setOpenChapterId((cur) => (cur === c.id ? null : c.id))}
                  >
                    <span>
                      {t('common.chapter', { number: c.number })}
                      {c.title ? ` — ${c.title}` : ''}
                    </span>
                    <span className={styles.moderationMeta}>{t('admin.pagesCount', { count: c.pages.length })}</span>
                  </button>
                  {openChapterId === c.id && (
                    <div className={styles.modalThumbGrid}>
                      {c.pages.map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className={styles.modalThumbLink}>
                          <img src={url} alt={t('reader.pageAlt', { number: i + 1 }) ?? ''} loading="lazy" className={styles.modalThumb} />
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
                    {t('admin.approve')}
                  </button>
                )}
                {onReject && (
                  <button type="button" className={styles.rejectButton} disabled={actingOn} onClick={onReject}>
                    <Trash2 size={14} />
                    {t('admin.reject')}
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
