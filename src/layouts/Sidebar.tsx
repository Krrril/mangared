import { NavLink, Link } from 'react-router-dom'
import {
  Home,
  Search,
  BookOpen,
  RefreshCw,
  LayoutGrid,
  TrendingUp,
  Heart,
  Clock,
  Download,
  Crown,
  ChevronDown,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_LANGUAGES } from '../i18n/languages'
import ContactsInline from '../components/ContactsInline'
import { useTheme } from '../services/theme/ThemeContext'
import type { Theme } from '../services/theme'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { to: '/', icon: Home, key: 'home' as const },
  { to: '/search', icon: Search, key: 'search' as const },
  { to: '/library', icon: BookOpen, key: 'library' as const },
  { to: '/updates', icon: RefreshCw, key: 'updates' as const },
  { to: '/categories', icon: LayoutGrid, key: 'categories' as const },
  { to: '/top', icon: TrendingUp, key: 'top' as const },
  { to: '/favorites', icon: Heart, key: 'favorites' as const },
  { to: '/history', icon: Clock, key: 'history' as const },
  { to: '/downloads', icon: Download, key: 'downloads' as const },
]

export default function Sidebar() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoMark}>M</span>
        <span className={styles.logoText}>{t('app.name')}</span>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={key}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
          >
            <Icon size={20} strokeWidth={1.75} />
            <span>{t(`nav.${key}`)}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.selectors}>
        <div className={styles.selectorGroup}>
          <span className={styles.selectorLabel}>{t('settings.language').toUpperCase()}</span>
          <div className={styles.selectorWrap}>
            <select
              className={styles.selector}
              value={i18n.resolvedLanguage ?? i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              aria-label={t('settings.language')}
            >
              {APP_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className={styles.selectorChevron} />
          </div>
        </div>
        <div className={styles.selectorGroup}>
          <span className={styles.selectorLabel}>{t('settings.theme').toUpperCase()}</span>
          <div className={styles.selectorWrap}>
            <select
              className={styles.selector}
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              aria-label={t('settings.theme')}
            >
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="light">{t('settings.themeLight')}</option>
            </select>
            <ChevronDown size={16} className={styles.selectorChevron} />
          </div>
        </div>
      </div>

      <div className={styles.premium}>
        <Crown size={20} className={styles.premiumIcon} />
        <p className={styles.premiumTitle}>{t('premium.title')}</p>
        <p className={styles.premiumDescription}>{t('premium.description')}</p>
        <button type="button" className={styles.premiumCta}>
          {t('premium.cta')}
        </button>
      </div>

      <p className={styles.attribution}>{t('common.poweredByMangadex')}</p>
      <ContactsInline />
      <nav className={styles.legalLinks} aria-label="legal">
        <Link to="/terms">{t('common.terms')}</Link>
        <Link to="/privacy">{t('common.privacy')}</Link>
        <Link to="/publishing-rules">{t('common.publishingRules')}</Link>
      </nav>
    </aside>
  )
}
