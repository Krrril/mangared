import { useState } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import { Home, Search, BookOpen, LogOut, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth/AuthContext'
import styles from './MobileTabBar.module.css'

/*
  Нижний таб-бар для мобильной ширины (см. DESIGN_SYSTEM.md, "Нижний
  таб-бар"). Показывается только через CSS-медиазапрос в .module.css —
  компонент всегда в DOM, десктоп его просто не видит (проще, чем
  синхронизировать JS-детект ширины с CSS-брейкпоинтом).
  4-й пункт "Профиль": авторизован — открывает мини-меню с выходом,
  гость — ведёт на /auth, как кнопка "Войти" в Topbar.
*/
export default function MobileTabBar() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className={styles.bar}>
      <NavLink to="/" end className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}>
        <Home size={22} strokeWidth={1.75} />
        <span>{t('nav.home')}</span>
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}>
        <Search size={22} strokeWidth={1.75} />
        <span>{t('nav.search')}</span>
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}>
        <BookOpen size={22} strokeWidth={1.75} />
        <span>{t('nav.library')}</span>
      </NavLink>

      <div className={styles.profileWrap}>
        <button
          type="button"
          className={`${styles.tab} ${styles.profileTab}`}
          onClick={() => (user ? setMenuOpen((v) => !v) : navigate('/auth'))}
        >
          {user ? (
            <span className={styles.avatar}>{user.name.charAt(0).toUpperCase()}</span>
          ) : (
            <span className={styles.avatarEmpty} />
          )}
          <span>{user ? user.name : t('auth.login')}</span>
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            {user?.isAdmin && (
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
    </nav>
  )
}
