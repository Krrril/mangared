import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Sun, Moon, Sparkles, ChevronDown, LogOut, SquarePen, Lock, User, Heart, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePublishCta } from '../hooks/usePublishCta'
import { useAuth } from '../services/auth/AuthContext'
import { useTheme } from '../services/theme/ThemeContext'
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead } from '../services/notifications/api'
import type { NotificationEntry } from '../services/notifications/api'
import NotificationRow from '../components/NotificationRow'
import styles from './Topbar.module.css'

export default function Topbar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const goToPublish = usePublishCta()

  const [value, setValue] = useState(() => searchParams.get('q') ?? '')
  const debouncedValue = useDebouncedValue(value, 350)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationEntry[] | null>(null)
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (!token) return
    getUnreadNotificationCount(token)
      .then(({ count }) => setHasUnread(count > 0))
      .catch(() => {})
  }, [token])

  function openNotifications() {
    setNotifOpen((v) => !v)
    if (!token || notifications) return
    getNotifications(token)
      .then((rows) => {
        setNotifications(rows)
        // Открыли — считаем прочитанными, badge гаснет (как в TikTok/IG,
        // не нужен отдельный клик "отметить прочитанным").
        if (rows.some((r) => !r.read)) {
          markAllNotificationsRead(token)
            .then(() => setHasUnread(false))
            .catch(() => {})
        }
      })
      .catch(() => setNotifications([]))
  }

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

        {token && (
          <div className={styles.profileWrap}>
            <button type="button" className={styles.iconButton} aria-label="notifications" onClick={openNotifications}>
              <Sparkles size={18} />
              {hasUnread && <span className={styles.newBadge}>{t('common.new')}</span>}
            </button>
            {notifOpen && (
              <div className={`${styles.menu} ${styles.notifMenu}`}>
                <p className={styles.notifHeading}>{t('notifications.heading')}</p>
                {notifications === null ? (
                  <p className={styles.notifEmpty}>{t('common.loading')}</p>
                ) : notifications.length === 0 ? (
                  <p className={styles.notifEmpty}>{t('notifications.empty')}</p>
                ) : (
                  <div className={styles.notifList}>
                    {notifications.map((entry) => (
                      <NotificationRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
