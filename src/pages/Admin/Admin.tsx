import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { ArrowUpDown, Search, Check, X, BookOpen, Trash2, ScrollText, LibraryBig, Eye, EyeOff, BarChart3, Smartphone, Monitor, Globe, MapPin } from 'lucide-react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useAuth } from '../../services/auth/AuthContext'
import {
  approveCoverRequest,
  approveOriginal,
  deleteAdminComment,
  deleteAdminManga,
  deleteAdminUser,
  excludeMyVisits,
  fetchAdminAnalytics,
  fetchAdminLogs,
  fetchAdminMangas,
  fetchAdminUsers,
  fetchPendingCommentReports,
  fetchPendingCoverRequests,
  fetchPendingOriginals,
  includeMyVisitsAgain,
  rejectCoverRequest,
  rejectOriginal,
  resolveCommentReport,
  type AdminAnalytics,
  type AdminLogEntry,
  type AdminManga,
  type AdminSort,
  type AdminUser,
  type MangaStatus,
  type PendingCommentReport,
  type PendingCoverRequest,
  type PendingOriginal,
} from '../../services/admin/api'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import AgeRatingBadge from '../../components/AgeRatingBadge'
import MainLayout from '../../layouts/MainLayout'
import AdminMangaDetailModal from './AdminMangaDetailModal'
import styles from './Admin.module.css'

type Tab = 'users' | 'moderation' | 'content' | 'analytics' | 'log'
type ModerationSubTab = 'pending' | 'coverRequests' | 'commentReports' | 'approved' | 'rejected'

const STATUS_FILTERS: (MangaStatus | 'all')[] = ['all', 'draft', 'pending', 'published', 'rejected']

// Intl.DisplayNames — встроенный в браузер способ превратить код страны
// ISO ("US", "RU") в человекочитаемое имя без отдельной библиотеки/списка.
function countryName(code: string, lang: string, unknownLabel: string): string {
  if (code === 'unknown') return unknownLabel
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/*
  /admin — доступен только пользователям с isAdmin=true (проставляется
  вручную в базе, см. ARCHITECTURE.md). Проверка на клиенте — только
  для UX (не показывать таблицу зря); реальная защита — на backend
  (requireAdmin в server/src/middleware/admin.ts), эндпоинт вернёт 403
  любому не-админу, даже если он подделает состояние на фронте.
*/
export default function Admin() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language
  const { user, token, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [sort, setSort] = useState<AdminSort>('createdAt_desc')

  const [pending, setPending] = useState<PendingOriginal[] | null>(null)
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [detailMangaId, setDetailMangaId] = useState<string | null>(null)

  const [moderationSubTab, setModerationSubTab] = useState<ModerationSubTab>('pending')
  const [archive, setArchive] = useState<AdminManga[] | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const [coverRequests, setCoverRequests] = useState<PendingCoverRequest[] | null>(null)
  const [coverRequestsError, setCoverRequestsError] = useState<string | null>(null)

  const [commentReports, setCommentReports] = useState<PendingCommentReport[] | null>(null)
  const [commentReportsError, setCommentReportsError] = useState<string | null>(null)

  const [mangas, setMangas] = useState<AdminManga[] | null>(null)
  const [mangasError, setMangasError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<MangaStatus | 'all'>('all')
  const [contentQuery, setContentQuery] = useState('')
  const debouncedContentQuery = useDebouncedValue(contentQuery, 300)

  const [logs, setLogs] = useState<AdminLogEntry[] | null>(null)
  const [logsError, setLogsError] = useState<string | null>(null)

  const [analyticsDays, setAnalyticsDays] = useState<7 | 30>(7)
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  // is_owner — httpOnly-кука (см. server/src/utils/visitCookies.ts), JS её
  // прочитать не может по определению — храним в localStorage только как
  // отражение последнего клика для подписи кнопки, не как источник истины.
  const [excludingOwn, setExcludingOwn] = useState(() => localStorage.getItem('mg_exclude_own_visits') === 'true')
  const [excludeToggling, setExcludeToggling] = useState(false)

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'users') return
    fetchAdminUsers(token, { q: debouncedQuery || undefined, sort })
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin.errLoadUsers')))
  }, [token, user?.isAdmin, debouncedQuery, sort, tab])

  function loadPending() {
    if (!token) return
    fetchPendingOriginals(token)
      .then(setPending)
      .catch((err) => setPendingError(err instanceof Error ? err.message : t('common.loadFailed')))
  }

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'moderation' || moderationSubTab !== 'pending') return
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.isAdmin, tab, moderationSubTab])

  function loadCoverRequests() {
    if (!token) return
    fetchPendingCoverRequests(token)
      .then(setCoverRequests)
      .catch((err) => setCoverRequestsError(err instanceof Error ? err.message : t('common.loadFailed')))
  }

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'moderation' || moderationSubTab !== 'coverRequests') return
    loadCoverRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.isAdmin, tab, moderationSubTab])

  function loadCommentReports() {
    if (!token) return
    fetchPendingCommentReports(token)
      .then(setCommentReports)
      .catch((err) => setCommentReportsError(err instanceof Error ? err.message : t('common.loadFailed')))
  }

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'moderation' || moderationSubTab !== 'commentReports') return
    loadCommentReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.isAdmin, tab, moderationSubTab])

  useEffect(() => {
    if (
      !token ||
      !user?.isAdmin ||
      tab !== 'moderation' ||
      moderationSubTab === 'pending' ||
      moderationSubTab === 'coverRequests' ||
      moderationSubTab === 'commentReports'
    )
      return
    setArchive(null)
    fetchAdminMangas(token, { status: moderationSubTab === 'approved' ? 'published' : 'rejected' })
      .then(setArchive)
      .catch((err) => setArchiveError(err instanceof Error ? err.message : t('common.loadFailed')))
  }, [token, user?.isAdmin, tab, moderationSubTab])

  function loadMangas() {
    if (!token) return
    fetchAdminMangas(token, { status: statusFilter === 'all' ? undefined : statusFilter, q: debouncedContentQuery || undefined })
      .then(setMangas)
      .catch((err) => setMangasError(err instanceof Error ? err.message : t('common.loadFailed')))
  }

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'content') return
    loadMangas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.isAdmin, tab, statusFilter, debouncedContentQuery])

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'log') return
    fetchAdminLogs(token)
      .then(setLogs)
      .catch((err) => setLogsError(err instanceof Error ? err.message : t('common.loadFailed')))
  }, [token, user?.isAdmin, tab])

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'analytics') return
    setAnalytics(null)
    fetchAdminAnalytics(token, analyticsDays)
      .then(setAnalytics)
      .catch((err) => setAnalyticsError(err instanceof Error ? err.message : t('common.loadFailed')))
  }, [token, user?.isAdmin, tab, analyticsDays])

  async function handleApprove(id: string) {
    if (!token) return
    setActingOn(id)
    try {
      await approveOriginal(token, id)
      setPending((prev) => prev?.filter((p) => p.id !== id) ?? null)
      setDetailMangaId((cur) => (cur === id ? null : cur))
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : t('admin.errApprove'))
    } finally {
      setActingOn(null)
    }
  }

  async function handleReject(id: string) {
    if (!token) return
    setActingOn(id)
    try {
      await rejectOriginal(token, id)
      setPending((prev) => prev?.filter((p) => p.id !== id) ?? null)
      setDetailMangaId((cur) => (cur === id ? null : cur))
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : t('admin.errReject'))
    } finally {
      setActingOn(null)
    }
  }

  async function handleApproveCoverRequest(id: string) {
    if (!token) return
    setActingOn(id)
    try {
      await approveCoverRequest(token, id)
      setCoverRequests((prev) => prev?.filter((r) => r.id !== id) ?? null)
    } catch (err) {
      setCoverRequestsError(err instanceof Error ? err.message : t('admin.errApprove'))
    } finally {
      setActingOn(null)
    }
  }

  async function handleRejectCoverRequest(id: string) {
    if (!token) return
    setActingOn(id)
    try {
      await rejectCoverRequest(token, id)
      setCoverRequests((prev) => prev?.filter((r) => r.id !== id) ?? null)
    } catch (err) {
      setCoverRequestsError(err instanceof Error ? err.message : t('admin.errReject'))
    } finally {
      setActingOn(null)
    }
  }

  async function handleResolveCommentReport(commentId: string) {
    if (!token) return
    setActingOn(commentId)
    try {
      await resolveCommentReport(token, commentId)
      setCommentReports((prev) => prev?.filter((r) => r.commentId !== commentId) ?? null)
    } catch (err) {
      setCommentReportsError(err instanceof Error ? err.message : t('admin.errResolve'))
    } finally {
      setActingOn(null)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!token) return
    if (!window.confirm(t('admin.deleteCommentConfirm') ?? '')) return
    setActingOn(commentId)
    try {
      await deleteAdminComment(token, commentId)
      setCommentReports((prev) => prev?.filter((r) => r.commentId !== commentId) ?? null)
    } catch (err) {
      setCommentReportsError(err instanceof Error ? err.message : t('admin.errDelete'))
    } finally {
      setActingOn(null)
    }
  }

  async function handleDeleteManga(m: AdminManga) {
    if (!token) return
    if (!window.confirm(t('admin.deleteMangaConfirm', { title: m.title, count: m.chaptersCount }) ?? '')) return
    setActingOn(m.id)
    try {
      await deleteAdminManga(token, m.id)
      setMangas((prev) => prev?.filter((x) => x.id !== m.id) ?? null)
    } catch (err) {
      setMangasError(err instanceof Error ? err.message : t('admin.errDelete'))
    } finally {
      setActingOn(null)
    }
  }

  async function handleDeleteUser(u: AdminUser) {
    if (!token) return
    if (
      !window.confirm(
        t('admin.deleteUserConfirm', { email: u.email }) ?? '',
      )
    )
      return
    setActingOn(u.id)
    try {
      await deleteAdminUser(token, u.id)
      setUsers((prev) => prev?.filter((x) => x.id !== u.id) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.errDelete'))
    } finally {
      setActingOn(null)
    }
  }

  async function handleToggleExcludeOwn() {
    if (!token) return
    setExcludeToggling(true)
    try {
      if (excludingOwn) {
        await includeMyVisitsAgain(token)
        setExcludingOwn(false)
        localStorage.setItem('mg_exclude_own_visits', 'false')
      } else {
        await excludeMyVisits(token)
        setExcludingOwn(true)
        localStorage.setItem('mg_exclude_own_visits', 'true')
      }
    } catch {
      // молча — это не критичное действие, кнопка просто не поменяет подпись
    } finally {
      setExcludeToggling(false)
    }
  }

  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />

  if (!user.isAdmin) {
    return (
      <MainLayout>
        <div className={styles.state}>{t('admin.accessDenied')}</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('admin.title')}</h1>

        <div className={styles.tabRow}>
          <button
            type="button"
            className={tab === 'users' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('users')}
          >
            {t('admin.tabUsers')}
          </button>
          <button
            type="button"
            className={tab === 'moderation' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('moderation')}
          >
            {t('admin.tabModeration')}
            {(pending?.length ?? 0) + (coverRequests?.length ?? 0) + (commentReports?.length ?? 0) > 0 && (
              <span className={styles.tabCount}>
                {(pending?.length ?? 0) + (coverRequests?.length ?? 0) + (commentReports?.length ?? 0)}
              </span>
            )}
          </button>
          <button
            type="button"
            className={tab === 'content' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('content')}
          >
            <LibraryBig size={14} />
            {t('admin.tabContent')}
          </button>
          <button
            type="button"
            className={tab === 'analytics' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('analytics')}
          >
            <BarChart3 size={14} />
            {t('admin.tabAnalytics')}
          </button>
          <button type="button" className={tab === 'log' ? styles.tabButtonActive : styles.tabButton} onClick={() => setTab('log')}>
            <ScrollText size={14} />
            {t('admin.tabLog')}
          </button>
        </div>

        {tab === 'moderation' && (
          <>
            <div className={styles.tabRow}>
              <button
                type="button"
                className={moderationSubTab === 'pending' ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setModerationSubTab('pending')}
              >
                {t('admin.subPending')}
                {pending && pending.length > 0 && <span className={styles.tabCount}>{pending.length}</span>}
              </button>
              <button
                type="button"
                className={moderationSubTab === 'coverRequests' ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setModerationSubTab('coverRequests')}
              >
                {t('admin.subCoverRequests')}
                {coverRequests && coverRequests.length > 0 && <span className={styles.tabCount}>{coverRequests.length}</span>}
              </button>
              <button
                type="button"
                className={moderationSubTab === 'commentReports' ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setModerationSubTab('commentReports')}
              >
                {t('admin.subCommentReports')}
                {commentReports && commentReports.length > 0 && <span className={styles.tabCount}>{commentReports.length}</span>}
              </button>
              <button
                type="button"
                className={moderationSubTab === 'approved' ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setModerationSubTab('approved')}
              >
                {t('admin.subApproved')}
              </button>
              <button
                type="button"
                className={moderationSubTab === 'rejected' ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setModerationSubTab('rejected')}
              >
                {t('admin.subRejected')}
              </button>
            </div>

            {moderationSubTab === 'pending' && (
              <>
                {pendingError && <div className={styles.state}>{pendingError}</div>}
                {!pendingError && !pending && <div className={styles.state}>{t('common.loading')}</div>}
                {!pendingError && pending && pending.length === 0 && (
                  <div className={styles.state}>
                    <BookOpen size={18} />
                    <p>{t('admin.nothingPending')}</p>
                  </div>
                )}
                {pending && pending.length > 0 && (
                  <div className={styles.moderationGrid}>
                    {pending.map((m) => (
                      <div key={m.id} className={styles.moderationCard}>
                        <button
                          type="button"
                          className={styles.moderationCoverButton}
                          onClick={() => setDetailMangaId(m.id)}
                          aria-label={t('a11y.viewDetails') ?? ''}
                        >
                          <CoverPlaceholder
                            cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                            name={m.title}
                            imageUrl={m.coverUrl ?? undefined}
                            className={styles.moderationCover}
                          />
                        </button>
                        <div className={styles.moderationInfo}>
                          <button type="button" className={styles.moderationTitleButton} onClick={() => setDetailMangaId(m.id)}>
                            <p className={styles.moderationTitle}>{m.title}</p>
                          </button>
                          <p className={styles.moderationMeta}>
                            {t('admin.metaByType', { author: m.author.displayName, type: t(`creator.contentType.${m.contentType}`), count: m.chaptersCount })}{' '}
                            <AgeRatingBadge rating={m.ageRating} />
                          </p>
                          {m.genres.length > 0 && (
                            <div className={styles.moderationGenres}>
                              {m.genres.map((g) => (
                                <span key={g} className={styles.badge}>
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className={styles.moderationDescription}>{m.description}</p>
                          <div className={styles.moderationActions}>
                            <button type="button" className={styles.tabButton} onClick={() => setDetailMangaId(m.id)}>
                              <Eye size={14} />
                              {t('admin.review')}
                            </button>
                            <button
                              type="button"
                              className={styles.approveButton}
                              disabled={actingOn === m.id}
                              onClick={() => handleApprove(m.id)}
                            >
                              <Check size={14} />
                              {t('admin.approve')}
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              disabled={actingOn === m.id}
                              onClick={() => handleReject(m.id)}
                            >
                              <X size={14} />
                              {t('admin.reject')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {moderationSubTab === 'coverRequests' && (
              <>
                {coverRequestsError && <div className={styles.state}>{coverRequestsError}</div>}
                {!coverRequestsError && !coverRequests && <div className={styles.state}>{t('common.loading')}</div>}
                {!coverRequestsError && coverRequests && coverRequests.length === 0 && (
                  <div className={styles.state}>
                    <BookOpen size={18} />
                    <p>{t('admin.noCoverRequests')}</p>
                  </div>
                )}
                {coverRequests && coverRequests.length > 0 && (
                  <div className={styles.moderationGrid}>
                    {coverRequests.map((r) => (
                      <div key={r.id} className={styles.moderationCard}>
                        <div className={styles.coverCompare}>
                          <div className={styles.coverCompareItem}>
                            <span className={styles.coverCompareLabel}>{t('admin.current')}</span>
                            <CoverPlaceholder
                              cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                              name={r.mangaTitle}
                              imageUrl={r.oldCoverUrl ?? undefined}
                              className={styles.moderationCover}
                            />
                          </div>
                          <div className={styles.coverCompareItem}>
                            <span className={styles.coverCompareLabel}>{t('admin.proposed')}</span>
                            <CoverPlaceholder
                              cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                              name={r.mangaTitle}
                              imageUrl={r.newCoverUrl}
                              className={styles.moderationCover}
                            />
                          </div>
                        </div>
                        <div className={styles.moderationInfo}>
                          <Link to={`/originals/${r.mangaId}`} className={styles.moderationTitle}>
                            {r.mangaTitle}
                          </Link>
                          <p className={styles.moderationMeta}>
                            {t('admin.coverMeta', { author: r.author.displayName, date: new Date(r.createdAt).toLocaleDateString() })}
                          </p>
                          <div className={styles.moderationActions}>
                            <button
                              type="button"
                              className={styles.approveButton}
                              disabled={actingOn === r.id}
                              onClick={() => handleApproveCoverRequest(r.id)}
                            >
                              <Check size={14} />
                              {t('admin.approve')}
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              disabled={actingOn === r.id}
                              onClick={() => handleRejectCoverRequest(r.id)}
                            >
                              <X size={14} />
                              {t('admin.reject')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {moderationSubTab === 'commentReports' && (
              <>
                {commentReportsError && <div className={styles.state}>{commentReportsError}</div>}
                {!commentReportsError && !commentReports && <div className={styles.state}>{t('common.loading')}</div>}
                {!commentReportsError && commentReports && commentReports.length === 0 && (
                  <div className={styles.state}>
                    <BookOpen size={18} />
                    <p>{t('admin.noCommentReports')}</p>
                  </div>
                )}
                {commentReports && commentReports.length > 0 && (
                  <div className={styles.moderationGrid}>
                    {commentReports.map((r) => (
                      <div key={r.commentId} className={styles.moderationCard}>
                        <div className={styles.moderationInfo}>
                          <Link
                            to={
                              r.source === 'original'
                                ? r.chapterId
                                  ? `/originals/${r.mangaId}/read/${r.chapterId}`
                                  : `/originals/${r.mangaId}`
                                : r.chapterId
                                  ? `/title/${r.mangaId}/read/${r.chapterId}`
                                  : `/title/${r.mangaId}`
                            }
                            className={styles.moderationTitle}
                          >
                            {r.mangaTitle ?? r.mangaId}
                          </Link>
                          <p className={styles.moderationMeta}>
                            {t('admin.reportMeta', { author: r.author.name, count: r.reportCount, date: new Date(r.firstReportedAt).toLocaleDateString() })}
                          </p>
                          <p className={styles.moderationDescription}>{r.text}</p>
                          <div className={styles.moderationActions}>
                            <button
                              type="button"
                              className={styles.approveButton}
                              disabled={actingOn === r.commentId}
                              onClick={() => handleResolveCommentReport(r.commentId)}
                            >
                              <Check size={14} />
                              {t('admin.dismiss')}
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              disabled={actingOn === r.commentId}
                              onClick={() => handleDeleteComment(r.commentId)}
                            >
                              <Trash2 size={14} />
                              {t('admin.deleteComment')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {moderationSubTab !== 'pending' && moderationSubTab !== 'coverRequests' && moderationSubTab !== 'commentReports' && (
              <>
                {archiveError && <div className={styles.state}>{archiveError}</div>}
                {!archiveError && !archive && <div className={styles.state}>{t('common.loading')}</div>}
                {!archiveError && archive && archive.length === 0 && (
                  <div className={styles.state}>
                    <BookOpen size={18} />
                    <p>{t('admin.nothingHere')}</p>
                  </div>
                )}
                {!archiveError && archive && archive.length > 0 && (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('admin.colTitle')}</th>
                          <th>{t('admin.colAuthor')}</th>
                          <th>{t('admin.colChapters')}</th>
                          <th>{moderationSubTab === 'approved' ? t('admin.colApprovedBy') : t('admin.colRejectedBy')}</th>
                          <th>{t('admin.colWhen')}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {archive.map((m) => (
                          <tr key={m.id}>
                            <td>{m.title}</td>
                            <td>{m.author.displayName}</td>
                            <td>{m.chaptersCount}</td>
                            <td>{m.decision?.admin ?? '—'}</td>
                            <td>{m.decision ? new Date(m.decision.at).toLocaleString() : '—'}</td>
                            <td>
                              <button type="button" className={styles.tabButton} onClick={() => setDetailMangaId(m.id)}>
                                <Eye size={14} />
                                {t('admin.view')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {detailMangaId && token && (
              <AdminMangaDetailModal
                mangaId={detailMangaId}
                token={token}
                onClose={() => setDetailMangaId(null)}
                onApprove={moderationSubTab === 'pending' ? () => handleApprove(detailMangaId) : undefined}
                onReject={moderationSubTab === 'pending' ? () => handleReject(detailMangaId) : undefined}
                actingOn={actingOn === detailMangaId}
              />
            )}
          </>
        )}

        {tab === 'content' && (
          <>
            <div className={styles.toolbar}>
              <input
                type="text"
                className={styles.search}
                placeholder={t('admin.searchByTitle') ?? ''}
                value={contentQuery}
                onChange={(e) => setContentQuery(e.target.value)}
              />
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={statusFilter === s ? styles.tabButtonActive : styles.tabButton}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? t('admin.filterAll') : t(`creator.status.${s}`)}
                </button>
              ))}
              {mangas && <span className={styles.count}>{t('admin.titlesCount', { count: mangas.length })}</span>}
            </div>

            {mangasError && <div className={styles.state}>{mangasError}</div>}
            {!mangasError && !mangas && <div className={styles.state}>{t('common.loading')}</div>}
            {!mangasError && mangas && mangas.length === 0 && (
              <div className={styles.state}>
                <Search size={18} />
                <p>{t('admin.noTitles')}</p>
              </div>
            )}

            {!mangasError && mangas && mangas.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('admin.colTitle')}</th>
                      <th>{t('admin.colAuthor')}</th>
                      <th>{t('admin.colStatus')}</th>
                      <th>{t('admin.colChapters')}</th>
                      <th>{t('admin.colUpdated')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mangas.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <Link to={`/originals/${m.id}`} className={styles.badge}>
                            {m.title}
                          </Link>
                        </td>
                        <td>{m.author.displayName}</td>
                        <td>
                          <span className={styles.badge}>{t(`creator.status.${m.status}`)}</span>
                        </td>
                        <td>{m.chaptersCount}</td>
                        <td>{new Date(m.updatedAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.rejectButton}
                            disabled={actingOn === m.id}
                            onClick={() => handleDeleteManga(m)}
                          >
                            <Trash2 size={14} />
                            {t('admin.delete')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'analytics' && (
          <>
            <div className={styles.toolbar}>
              <button
                type="button"
                className={analyticsDays === 7 ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setAnalyticsDays(7)}
              >
                {t('admin.last7')}
              </button>
              <button
                type="button"
                className={analyticsDays === 30 ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setAnalyticsDays(30)}
              >
                {t('admin.last30')}
              </button>
              <button type="button" className={styles.tabButton} disabled={excludeToggling} onClick={handleToggleExcludeOwn}>
                {excludingOwn ? <Eye size={14} /> : <EyeOff size={14} />}
                {excludingOwn ? t('admin.excludeOwnOn') : t('admin.excludeOwnOff')}
              </button>
            </div>
            {excludingOwn && (
              <p className={styles.moderationMeta}>
                {t('admin.excludedNote')}
              </p>
            )}

            {analyticsError && <div className={styles.state}>{analyticsError}</div>}
            {!analyticsError && !analytics && <div className={styles.state}>{t('common.loading')}</div>}

            {!analyticsError && analytics && (
              <>
                <div className={styles.dashboardStats}>
                  <div className={styles.dashboardTile}>
                    <span className={styles.dashboardValue}>{analytics.total}</span>
                    <span className={styles.dashboardLabel}>{t('admin.pageViews', { days: analytics.days })}</span>
                  </div>
                  <div className={styles.dashboardTile}>
                    <span className={styles.dashboardValue}>{analytics.byDevice.mobile ?? 0}</span>
                    <span className={styles.dashboardLabel}>
                      <Smartphone size={12} /> {t('admin.mobile')}
                    </span>
                  </div>
                  <div className={styles.dashboardTile}>
                    <span className={styles.dashboardValue}>{analytics.byDevice.desktop ?? 0}</span>
                    <span className={styles.dashboardLabel}>
                      <Monitor size={12} /> {t('admin.desktop')}
                    </span>
                  </div>
                </div>

                <h3 className={styles.modalSectionTitle}>
                  <Globe size={14} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                  {t('admin.topCountries')}
                </h3>

                {analytics.byCountry.length === 0 ? (
                  <div className={styles.state}>
                    <BarChart3 size={18} />
                    <p>{t('admin.noVisits')}</p>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('admin.colCountry')}</th>
                          <th>{t('admin.colVisits')}</th>
                          <th>{t('admin.colShare')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.byCountry.map((row) => (
                          <tr key={row.country}>
                            <td>{countryName(row.country, lang, t('admin.unknown'))}</td>
                            <td>{row.count}</td>
                            <td>{analytics.total > 0 ? `${Math.round((row.count / analytics.total) * 100)}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className={styles.modalSectionTitle}>
                  <MapPin size={14} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                  {t('admin.topCities')}
                </h3>

                {analytics.byCity.length === 0 ? (
                  <div className={styles.state}>
                    <MapPin size={18} />
                    <p>{t('admin.noCityData')}</p>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('admin.colCity')}</th>
                          <th>{t('admin.colRegion')}</th>
                          <th>{t('admin.colCountry')}</th>
                          <th>{t('admin.colVisits')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.byCity.map((row) => (
                          <tr key={`${row.city}|${row.region}|${row.country}`}>
                            <td>{row.city}</td>
                            <td>{row.region || '—'}</td>
                            <td>{row.country ? countryName(row.country, lang, t('admin.unknown')) : '—'}</td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'log' && (
          <>
            {logsError && <div className={styles.state}>{logsError}</div>}
            {!logsError && !logs && <div className={styles.state}>{t('common.loading')}</div>}
            {!logsError && logs && logs.length === 0 && (
              <div className={styles.state}>
                <ScrollText size={18} />
                <p>{t('admin.noLogs')}</p>
              </div>
            )}
            {!logsError && logs && logs.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('admin.colWhen')}</th>
                      <th>{t('admin.colAdmin')}</th>
                      <th>{t('admin.colAction')}</th>
                      <th>{t('admin.colDetails')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td>{new Date(l.createdAt).toLocaleString()}</td>
                        <td>{l.adminName}</td>
                        <td>
                          <span className={styles.badge}>{l.action}</span>
                        </td>
                        <td>{l.details ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'users' && (
          <>
            <div className={styles.toolbar}>
              <input
                type="text"
                className={styles.search}
                placeholder={t('admin.searchByNameEmail') ?? ''}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                className={styles.sortButton}
                onClick={() => setSort((s) => (s === 'createdAt_desc' ? 'createdAt_asc' : 'createdAt_desc'))}
              >
                <ArrowUpDown size={14} />
                {sort === 'createdAt_desc' ? t('admin.newestFirst') : t('admin.oldestFirst')}
              </button>
              {users && <span className={styles.count}>{t('admin.usersCount', { count: users.length })}</span>}
            </div>

            {error && <div className={styles.state}>{error}</div>}

            {!error && !users && <div className={styles.state}>{t('common.loading')}</div>}

            {!error && users && users.length === 0 && (
              <div className={styles.state}>
                <Search size={18} />
                <p>{t('admin.noUsers')}</p>
              </div>
            )}

            {!error && users && users.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('admin.colName')}</th>
                      <th>{t('admin.colEmail')}</th>
                      <th>{t('admin.colRegistered')}</th>
                      <th>{t('admin.colLoginMethod')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          {u.name}
                          {u.isAdmin && <span className={`${styles.badge} ${styles.adminBadge}`}>{' '}{t('admin.adminBadge')}</span>}
                        </td>
                        <td>{u.email}</td>
                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td>
                          <span className={styles.badge}>{u.loginMethod}</span>
                        </td>
                        <td>
                          {u.id !== user.id && (
                            <button
                              type="button"
                              className={styles.rejectButton}
                              disabled={actingOn === u.id}
                              onClick={() => handleDeleteUser(u)}
                            >
                              <Trash2 size={14} />
                              {t('admin.delete')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  )
}
