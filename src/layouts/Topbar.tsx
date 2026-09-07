import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Sun, Moon, Sparkles, ChevronDown, LogOut, SquarePen, Lock, User, Heart, History, Languages, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePublishCta } from '../hooks/usePublishCta'
import { useAuth } from '../services/auth/AuthContext'
import { useTheme } from '../services/theme/ThemeContext'
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead } from '../services/notifications/api'
import type { NotificationEntry } from '../services/notifications/api'
import NotificationRow from '../components/NotificationRow'
import { APP_LANGUAGES } from '../i18n/languages'
import styles from './Topbar.module.css'

export default function Topbar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const goToPublish = usePublishCta()

  const [value, setValue] = useState(() => searchParams.get('q') ?? '')
  const debouncedValue = useDebouncedValue(value, 350)
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationEntry[] | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!token) return
    const refresh = () => getUnreadNotificationCount(token).then(({ count }) => setUnreadCount(count)).catch(() => {})
    refresh()
    // Нет WebSocket-инфраструктуры под уведомления — простой поллинг раз в
    // минуту вместо неё: достаточно, чтобы бейдж не "залипал" на весь сеанс,
    // не требуя постоянного соединения ради довольно редких событий (лайк/подписка).
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [token])

  function openNotifications() {
    const opening = !notifOpen
    setNotifOpen(opening)
    if (!opening || !token) return
    // Перезагружаем список при КАЖДОМ открытии (не только при первом) —
    // иначе уведомления, пришедшие после первой загрузки страницы, никогда
    // бы не попали в список до полной перезагрузки (см. bug report сессии).
    setNotifications(null)
    getNotifications(token)
      .then(setNotifications)
      .catch(() => setNotifications([]))
  }

  function handleReadOne(id: string) {
    if (!token) return
    setNotifications((prev) => (prev ? prev.map((n) => (n.id === id ? { ...n, read: true } : n)) : prev))
    setUnreadCount((c) => Math.max(0, c - 1))
    markNotificationRead(token, id).catch(() => {})
  }

  function handleReadAll() {
    if (!token) return
    setNotifications((prev) => (prev ? prev.map((n) => ({ ...n, read: true })) : prev))
    setUnreadCount(0)
    markAllNotificationsRead(token).catch(() => {})
  }

  // Тот же переключатель, что в Sidebar.tsx (десктоп) — Sidebar скрыт на
  // мобильном (см. Sidebar.module.css), а язык интерфейса должен быть
  // доступен независимо от ширины экрана, поэтому дублируем в Topbar
  // (виден только на мобильном — см. .langWrap в Topbar.module.css).
  function handleLanguageChange(code: string) {
    i18n.changeLanguage(code)
    const next = new URLSearchParams(searchParams)
    if (code === 'en') next.delete('lang')
    else next.set('lang', code)
    setSearchParams(next, { replace: true })
    setLangOpen(false)
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

        <div className={`${styles.langWrap} ${styles.profileWrap}`}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('settings.language') ?? 'language'}
            onClick={() => setLangOpen((v) => !v)}
          >
            <Languages size={18} />
          </button>
          {langOpen && (
            <div className={`${styles.menu} ${styles.langMenu}`}>
              {APP_LANGUAGES.map((lang) => {
                const active = (i18n.resolvedLanguage ?? i18n.language) === lang.code
                return (
                  <button
                    key={lang.code}
                    type="button"
                    className={styles.menuItem}
                    onClick={() => handleLanguageChange(lang.code)}
                  >
                    <Check size={14} style={{ visibility: active ? 'visible' : 'hidden' }} />
                    <span className={active ? styles.langActiveLabel : undefined}>{lang.nativeName}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

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
              {unreadCount > 0 && <span className={styles.newBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className={`${styles.menu} ${styles.notifMenu}`}>
                <div className={styles.notifHeadingRow}>
                  <p className={styles.notifHeading}>{t('notifications.heading')}</p>
                  {notifications && notifications.some((n) => !n.read) && (
                    <button type="button" className={styles.notifMarkAllButton} onClick={handleReadAll}>
                      {t('notifications.markAllRead')}
                    </button>
                  )}
                </div>
                {notifications === null ? (
                  <p className={styles.notifEmpty}>{t('common.loading')}</p>
                ) : notifications.length === 0 ? (
                  <p className={styles.notifEmpty}>{t('notifications.empty')}</p>
                ) : (
                  <div className={styles.notifList}>
                    {notifications.map((entry) => (
                      <NotificationRow key={entry.id} entry={entry} onRead={handleReadOne} />
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
