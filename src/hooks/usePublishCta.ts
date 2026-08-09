import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth/AuthContext'

/**
 * Клик по "Опубликовать" где угодно на сайте (Topbar, PublishHero,
 * позже — Creator studio): авторизован — сразу в студию, гость — на
 * вход с уведомлением и редиректом обратно в студию после входа (см.
 * Auth.tsx, notice в location.state).
 */
export function usePublishCta() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return function goToPublish() {
    if (user) {
      navigate('/creator/new')
    } else {
      navigate('/auth', { state: { from: '/creator/new', notice: 'publish.authNotice' } })
    }
  }
}
