import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useAuth } from '../services/auth/AuthContext'
import styles from './NicknamePrompt.module.css'

/*
  Мягкая подсказка "Выберите свой @ник" — один раз для тех, кто вошёл через
  Google/Яндекс (там ник выдан автоматически из имени) и ещё не менял его.
  Никаких модальных окон и блокировок: обычная полоса над содержимым,
  закрывается крестиком, и это запоминается на этом устройстве.
  Серверные поля: oauthAccount и usernameChangedAt из /auth/me — если
  старый бэкенд их не присылает, подсказка просто не показывается.
*/

const DISMISS_PREFIX = 'mangared:nick-prompt-dismissed:'

function wasDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(DISMISS_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export default function NicknamePrompt() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const [dismissedNow, setDismissedNow] = useState(false)

  if (!user || !user.oauthAccount || user.usernameChangedAt || !user.authorUsername) return null
  if (dismissedNow || wasDismissed(user.id)) return null
  // Уже на странице настроек — подсказка лишняя.
  if (location.pathname === '/settings') return null

  function dismiss() {
    if (!user) return
    try {
      localStorage.setItem(DISMISS_PREFIX + user.id, '1')
    } catch {
      // приватный режим — закроем только до перезагрузки
    }
    setDismissedNow(true)
  }

  return (
    <div className={styles.banner} role="note">
      <p className={styles.text}>{t('settings.nickPrompt.text', { username: user.authorUsername })}</p>
      <Link to="/settings" className={styles.action}>
        {t('settings.nickPrompt.action')}
      </Link>
      <button type="button" className={styles.close} onClick={dismiss} aria-label={t('settings.nickPrompt.dismiss') ?? ''}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
