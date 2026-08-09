import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowUpDown, Search, Check, X, BookOpen } from 'lucide-react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useAuth } from '../../services/auth/AuthContext'
import {
  approveOriginal,
  fetchAdminUsers,
  fetchPendingOriginals,
  rejectOriginal,
  type AdminSort,
  type AdminUser,
  type PendingOriginal,
} from '../../services/admin/api'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import MainLayout from '../../layouts/MainLayout'
import styles from './Admin.module.css'

type Tab = 'users' | 'moderation'

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
    if (!token || !user?.isAdmin || tab !== 'moderation') return
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.isAdmin, tab])

  async function handleApprove(id: string) {
    if (!token) return
    setActingOn(id)
    try {
      await approveOriginal(token, id)
      setPending((prev) => prev?.filter((p) => p.id !== id) ?? null)
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
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : 'Failed to reject')
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
        </div>

        {tab === 'moderation' ? (
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
                    <CoverPlaceholder
                      cover={{ from: '#2a2a3a', to: '#1a1a24' }}
                      name={m.title}
                      imageUrl={m.coverUrl ?? undefined}
                      className={styles.moderationCover}
                    />
                    <div className={styles.moderationInfo}>
                      <p className={styles.moderationTitle}>{m.title}</p>
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
        ) : (
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
