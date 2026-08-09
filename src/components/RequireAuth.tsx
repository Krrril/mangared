import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../services/auth/AuthContext'

/**
 * Обёртка для приватных страниц (Студия автора и т.д.) — гостя отправляет
 * на /auth с редиректом обратно после входа (тот же паттерн, что уже
 * использует PublishHero/Topbar). Клиентская проверка — только для UX,
 * реальная защита всегда на backend (requireAuth на каждом private-роуте).
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/auth" state={{ from: location.pathname }} replace />

  return children
}
