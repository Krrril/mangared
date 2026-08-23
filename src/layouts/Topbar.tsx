import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Sun, Moon, Bell, ChevronDown, LogOut, SquarePen, Lock, User, Heart, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePublishCta } from '../hooks/usePublishCta'
import { useAuth } from '../services/auth/AuthContext'
import { useTheme } from '../services/theme/ThemeContext'
import { getUpdatesFeed } from '../services/content'
import type { UpdateFeedEntry } from '../services/content'
import UpdateRow from '../components/UpdateRow'
import styles from './Topbar.module.css'

export default function Topbar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const goToPublish = usePublishCta()

  const [value, setValue] = useState(() => searchParams.get('q') ?? '')
  const debouncedValue = useDebouncedValue(value, 350)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [updates, setUpdates] = useState<UpdateFeedEntry[]>([])

  useEffect(() => {
    getUpdatesFeed(5).then(setUpdates)
  }, [])

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
        <button type="button" className={styles.publishButton} onClick={goToPublish}>
          <SquarePen size={16} />
          <span className={styles.publishButtonLabel}>{t('publish.topbarCta')}</span>
        </button>

        <button
          type="button"
          className={styles.iconButton}
          aria-label="theme"
          onClick={toggleTheme}
          title={theme === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
        >
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className={styles.profileWrap}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="notifications"
            onClick={() => setNotifOpen((v) => !v)}
          >
            <Bell size={18} />
            {updates.length > 0 && <span className={styles.badge}>{updates.length}</span>}
          </button>
          {notifOpen && (
            <div className={`${styles.menu} ${styles.notifMenu}`}>
              <p className={styles.notifHeading}>{t('sections.recentUpdates')}</p>
              {updates.length === 0 ? (
                <p className={styles.notifEmpty}>{t('common.loading')}</p>
              ) : (
                <div className={styles.notifList}>
                  {updates.map((entry) => (
                    <UpdateRow key={entry.chapterId} entry={entry} />
                  ))}
                </div>
              )}
              <Link to="/updates" className={styles.notifSeeAll} onClick={() => setNotifOpen(false)}>
                {t('sections.seeAll')}
              </Link>
            </div>
          )}
        </div>

        {user ? (
          <div className={styles.profileWrap}>
            <button type="button" className={styles.profile} onClick={() => setMenuOpen((v) => !v)}>
              <span className={styles.avatar}>
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : user.name.charAt(0).toUpperCase()}
              </span>
              <span className={styles.profileEmail}>{user.name}</span>
              <ChevronDown size={16} />
            </button>
            {menuOpen && (
              <div className={styles.menu}>
                {user.authorUsername && (
                  <Link to={`/author/${user.authorUsername}`} className={styles.menuItem} onClick={() => setMenuOpen(false)}>
                    <User size={15} />
                    {t('profileMenu.authorProfile')}
                  </Link>
                )}
                <Link to="/favorites" className={styles.menuItem} onClick={() => setMenuOpen(false)}>
                  <Heart size={15} />
                  {t('nav.favorites')}
                </Link>
                <Link to="/history" className={styles.menuItem} onClick={() => setMenuOpen(false)}>
                  <History size={15} />
                  {t('nav.history')}
                </Link>
                {user.isAdmin && (
                  <Link to="/admin" className={styles.menuItem} onClick={() => setMenuOpen(false)}>
                    <Lock size={15} />
                    {t('admin.menuItem')}
                  </Link>
                )}
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
