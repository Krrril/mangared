import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Sun, Bell, ChevronDown, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAuth } from '../services/auth/AuthContext'
import styles from './Topbar.module.css'

export default function Topbar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, logout } = useAuth()

  const [value, setValue] = useState(() => searchParams.get('q') ?? '')
  const debouncedValue = useDebouncedValue(value, 350)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const trimmed = debouncedValue.trim()
    const currentQuery = new URLSearchParams(location.search).get('q') ?? ''
    // Ничего не поменялось относительно текущего URL — не дёргаем роутер.
    // Важно и для устойчивости к двойному вызову эффектов в React StrictMode.
    if (trimmed === currentQuery) return
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue])

  const goToSearchNow = () => {
    const trimmed = value.trim()
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search')
  }

  return (
    <header className={styles.topbar}>
      <form
        className={styles.searchBox}
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          goToSearchNow()
        }}
      >
        <Search size={18} className={styles.searchIcon} />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('topbar.searchPlaceholder') ?? ''}
          className={styles.searchInput}
        />
        <span className={styles.shortcut}>{t('topbar.shortcutHint')}</span>
      </form>

      <div className={styles.actions}>
        <button type="button" className={styles.iconButton} aria-label="theme">
          <Sun size={18} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="notifications">
          <Bell size={18} />
          <span className={styles.badge}>3</span>
        </button>

        {user ? (
          <div className={styles.profileWrap}>
            <button type="button" className={styles.profile} onClick={() => setMenuOpen((v) => !v)}>
              <span className={styles.avatar}>{user.email.charAt(0).toUpperCase()}</span>
              <span className={styles.profileEmail}>{user.email}</span>
              <ChevronDown size={16} />
            </button>
            {menuOpen && (
              <div className={styles.menu}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                >
                  <LogOut size={15} />
                  {t('auth.logout')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/auth" className={styles.loginButton}>
            {t('auth.login')}
          </Link>
        )}
      </div>
    </header>
  )
}
