import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowUpDown, Search, Check, X, BookOpen, Trash2, ScrollText, LibraryBig, Eye } from 'lucide-react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useAuth } from '../../services/auth/AuthContext'
import {
  approveOriginal,
  deleteAdminManga,
  deleteAdminUser,
  fetchAdminLogs,
  fetchAdminMangas,
  fetchAdminUsers,
  fetchPendingOriginals,
  rejectOriginal,
  type AdminLogEntry,
  type AdminManga,
  type AdminSort,
  type AdminUser,
  type MangaStatus,
  type PendingOriginal,
} from '../../services/admin/api'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import MainLayout from '../../layouts/MainLayout'
import AdminMangaDetailModal from './AdminMangaDetailModal'
import styles from './Admin.module.css'

type Tab = 'users' | 'moderation' | 'content' | 'log'
type ModerationSubTab = 'pending' | 'approved' | 'rejected'

const STATUS_FILTERS: (MangaStatus | 'all')[] = ['all', 'draft', 'pending', 'published', 'rejected']

/*
  /admin — доступен только пользователям с isAdmin=true (проставляется
  вручную в базе, см. ARCHITECTURE.md). Проверка на клиенте — только
  для UX (не показывать таблицу зря); реальная защита — на backend
  (requireAdmin в server/src/middleware/admin.ts), эндпоинт вернёт 403
  любому не-админу, даже если он подделает состояние на фронте.
*/
export default function Admin() {
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

  const [mangas, setMangas] = useState<AdminManga[] | null>(null)
  const [mangasError, setMangasError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<MangaStatus | 'all'>('all')
  const [contentQuery, setContentQuery] = useState('')
  const debouncedContentQuery = useDebouncedValue(contentQuery, 300)

  const [logs, setLogs] = useState<AdminLogEntry[] | null>(null)
  const [logsError, setLogsError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'users') return
    fetchAdminUsers(token, { q: debouncedQuery || undefined, sort })
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
  }, [token, user?.isAdmin, debouncedQuery, sort, tab])

  function loadPending() {
    if (!token) return
    fetchPendingOriginals(token)
      .then(setPending)
      .catch((err) => setPendingError(err instanceof Error ? err.message : 'Failed to load'))
  }

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'moderation' || moderationSubTab !== 'pending') return
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.isAdmin, tab, moderationSubTab])

  useEffect(() => {
    if (!token || !user?.isAdmin || tab !== 'moderation' || moderationSubTab === 'pending') return
    setArchive(null)
    fetchAdminMangas(token, { status: moderationSubTab === 'approved' ? 'published' : 'rejected' })
      .then(setArchive)
      .catch((err) => setArchiveError(err instanceof Error ? err.message : 'Failed to load'))
  }, [token, user?.isAdmin, tab, moderationSubTab])

  function loadMangas() {
    if (!token) return
    fetchAdminMangas(token, { status: statusFilter === 'all' ? undefined : statusFilter, q: debouncedContentQuery || undefined })
      .then(setMangas)
      .catch((err) => setMangasError(err instanceof Error ? err.message : 'Failed to load'))
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
      .catch((err) => setLogsError(err instanceof Error ? err.message : 'Failed to load'))
  }, [token, user?.isAdmin, tab])

  async function handleApprove(id: string) {
    if (!token) return
    setActingOn(id)
    try {
      await approveOriginal(token, id)
      setPending((prev) => prev?.filter((p) => p.id !== id) ?? null)
      setDetailMangaId((cur) => (cur === id ? null : cur))
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : 'Failed to approve')
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
      setPendingError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setActingOn(null)
    }
  }

  async function handleDeleteManga(m: AdminManga) {
    if (!token) return
    if (!window.confirm(`Удалить тайтл «${m.title}» (${m.chaptersCount} глав) целиком? Это необратимо.`)) return
    setActingOn(m.id)
    try {
      await deleteAdminManga(token, m.id)
      setMangas((prev) => prev?.filter((x) => x.id !== m.id) ?? null)
    } catch (err) {
      setMangasError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setActingOn(null)
    }
  }

  async function handleDeleteUser(u: AdminUser) {
    if (!token) return
    if (
      !window.confirm(
        `Удалить пользователя ${u.email}? Если у него есть опубликованные тайтлы — они тоже будут удалены безвозвратно.`,
      )
    )
      return
    setActingOn(u.id)
    try {
      await deleteAdminUser(token, u.id)
      setUsers((prev) => prev?.filter((x) => x.id !== u.id) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setActingOn(null)
    }
  }

  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />

  if (!user.isAdmin) {
    return (
      <MainLayout>
        <div className={styles.state}>Access denied — this page is for administrators only.</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Admin</h1>

        <div className={styles.tabRow}>
          <button
            type="button"
            className={tab === 'users' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('users')}
          >
            Users
          </button>
          <button
            type="button"
            className={tab === 'moderation' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('moderation')}
          >
            Moderation
            {pending && pending.length > 0 && <span className={styles.tabCount}>{pending.length}</span>}
          </button>
          <button
            type="button"
            className={tab === 'content' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('content')}
          >
            <LibraryBig size={14} />
            Content
          </button>
          <button type="button" className={tab === 'log' ? styles.tabButtonActive : styles.tabButton} onClick={() => setTab('log')}>
            <ScrollText size={14} />
            Log
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
                Pending
                {pending && pending.length > 0 && <span className={styles.tabCount}>{pending.length}</span>}
              </button>
              <button
                type="button"
                className={moderationSubTab === 'approved' ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setModerationSubTab('approved')}
              >
                Approved
              </button>
              <button
                type="button"
                className={moderationSubTab === 'rejected' ? styles.tabButtonActive : styles.tabButton}
                onClick={() => setModerationSubTab('rejected')}
              >
                Rejected
              </button>
            </div>

            {moderationSubTab === 'pending' && (
              <>
                {pendingError && <div className={styles.state}>{pendingError}</div>}
                {!pendingError && !pending && <div className={styles.state}>Loading…</div>}
                {!pendingError && pending && pending.length === 0 && (
                  <div className={styles.state}>
                    <BookOpen size={18} />
                    <p>Nothing pending review.</p>
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
                          aria-label="view details"
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
                            by {m.author.displayName} · {m.contentType} · {m.chaptersCount} ch.
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
                              Review
                            </button>
                            <button
                              type="button"
                              className={styles.approveButton}
                              disabled={actingOn === m.id}
                              onClick={() => handleApprove(m.id)}
                            >
                              <Check size={14} />
                              Approve
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              disabled={actingOn === m.id}
                              onClick={() => handleReject(m.id)}
                            >
                              <X size={14} />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {moderationSubTab !== 'pending' && (
              <>
                {archiveError && <div className={styles.state}>{archiveError}</div>}
                {!archiveError && !archive && <div className={styles.state}>Loading…</div>}
                {!archiveError && archive && archive.length === 0 && (
                  <div className={styles.state}>
                    <BookOpen size={18} />
                    <p>Nothing here yet.</p>
                  </div>
                )}
                {!archiveError && archive && archive.length > 0 && (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Author</th>
                          <th>Chapters</th>
                          <th>{moderationSubTab === 'approved' ? 'Approved by' : 'Rejected by'}</th>
                          <th>When</th>
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
                                View
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
                placeholder="Search by title…"
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
                  {s}
                </button>
              ))}
              {mangas && <span className={styles.count}>{mangas.length} titles</span>}
            </div>

            {mangasError && <div className={styles.state}>{mangasError}</div>}
            {!mangasError && !mangas && <div className={styles.state}>Loading…</div>}
            {!mangasError && mangas && mangas.length === 0 && (
              <div className={styles.state}>
                <Search size={18} />
                <p>No titles found.</p>
              </div>
            )}

            {!mangasError && mangas && mangas.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Status</th>
                      <th>Chapters</th>
                      <th>Updated</th>
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
                          <span className={styles.badge}>{m.status}</span>
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
                            Delete
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

        {tab === 'log' && (
          <>
            {logsError && <div className={styles.state}>{logsError}</div>}
            {!logsError && !logs && <div className={styles.state}>Loading…</div>}
            {!logsError && logs && logs.length === 0 && (
              <div className={styles.state}>
                <ScrollText size={18} />
                <p>No admin actions logged yet.</p>
              </div>
            )}
            {!logsError && logs && logs.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Details</th>
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
                placeholder="Search by name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                className={styles.sortButton}
                onClick={() => setSort((s) => (s === 'createdAt_desc' ? 'createdAt_asc' : 'createdAt_desc'))}
              >
                <ArrowUpDown size={14} />
                {sort === 'createdAt_desc' ? 'Newest first' : 'Oldest first'}
              </button>
              {users && <span className={styles.count}>{users.length} users</span>}
            </div>

            {error && <div className={styles.state}>{error}</div>}

            {!error && !users && <div className={styles.state}>Loading…</div>}

            {!error && users && users.length === 0 && (
              <div className={styles.state}>
                <Search size={18} />
                <p>No users found.</p>
              </div>
            )}

            {!error && users && users.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registered</th>
                      <th>Login method</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          {u.name}
                          {u.isAdmin && <span className={`${styles.badge} ${styles.adminBadge}`}> admin</span>}
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
                              Delete
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
