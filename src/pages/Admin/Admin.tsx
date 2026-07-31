import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowUpDown, Search } from 'lucide-react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useAuth } from '../../services/auth/AuthContext'
import { fetchAdminUsers, type AdminSort, type AdminUser } from '../../services/admin/api'
import MainLayout from '../../layouts/MainLayout'
import styles from './Admin.module.css'

/*
  /admin — доступен только пользователям с isAdmin=true (проставляется
  вручную в базе, см. ARCHITECTURE.md). Проверка на клиенте — только
  для UX (не показывать таблицу зря); реальная защита — на backend
  (requireAdmin в server/src/middleware/admin.ts), эндпоинт вернёт 403
  любому не-админу, даже если он подделает состояние на фронте.
*/
export default function Admin() {
  const { user, token, loading } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [sort, setSort] = useState<AdminSort>('createdAt_desc')

  useEffect(() => {
    if (!token || !user?.isAdmin) return
    fetchAdminUsers(token, { q: debouncedQuery || undefined, sort })
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
  }, [token, user?.isAdmin, debouncedQuery, sort])

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
        <h1 className={styles.title}>Admin — Users</h1>

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
      </div>
    </MainLayout>
  )
}
