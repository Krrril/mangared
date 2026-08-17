import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, googleLoginRequest, loginRequest, meRequest, registerRequest, type AuthUser } from './api'
import { TOKEN_KEY } from './token'
import { migrateGuestDataToAccount } from '../migration'

// Между попытками проверить сохранённый токен при "холодном" Render —
// бесплатный план засыпает через ~15 минут без запросов, будит его первый
// запрос до ~50 секунд (см. DECISIONS.md), поэтому сумма задержек здесь
// сопоставима с этим временем, а не пара секунд.
const ME_RETRY_DELAYS_MS = [1500, 4000, 8000, 15000]

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  /** Пока true — идёт проверка сохранённого токена при загрузке приложения */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  logout: () => void
  /**
   * Перечитывает /auth/me — нужно после действий, которые меняют профиль
   * пользователя на бэкенде, но не возвращают его целиком (например,
   * первая публикация тайтла создаёт AuthorProfile "по пути", см.
   * originals.ts, getOrCreateAuthorProfile — без этого вызова
   * user.authorUsername в контексте оставался бы null до следующего
   * входа, и пункт меню "Мой профиль автора" не появлялся сразу).
   */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Только один раз при загрузке приложения — проверяем токен,
    // сохранённый с прошлого визита. login/register/loginWithGoogle уже
    // получают user в ответе на сам запрос и не нуждаются в повторном
    // походе на /me — раньше это дублировало сетевой запрос сразу после
    // входа (лишняя задержка, особенно на "холодном" Render, см. DECISIONS.md).
    const initialToken = token
    if (!initialToken) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function checkStoredToken() {
      for (let attempt = 0; ; attempt++) {
        try {
          const me = await meRequest(initialToken!)
          if (!cancelled) setUser(me)
          return
        } catch (err) {
          // 401/404 от /auth/me — сервер явно сказал "токен невалиден или
          // пользователя больше нет", тут действительно нужно разлогинить.
          // Любая другая ошибка (сетевой сбой, 5xx, "холодный" Render —
          // см. ME_RETRY_DELAYS_MS выше) НЕ означает, что 30-дневный токен
          // истёк — раньше это тоже трактовалось как "невалиден", из-за
          // чего пользователей выкидывало из аккаунта на ровном месте при
          // каждой перезагрузке страницы, попавшей на просыпающийся сервер.
          const isAuthRejected = err instanceof ApiError && (err.status === 401 || err.status === 404)
          if (isAuthRejected) {
            if (!cancelled) {
              localStorage.removeItem(TOKEN_KEY)
              setToken(null)
              setUser(null)
            }
            return
          }
          if (attempt >= ME_RETRY_DELAYS_MS.length || cancelled) {
            // Все попытки исчерпаны без внятного отказа — сервер просто
            // недоступен. Токен не трогаем: он ещё может быть рабочим,
            // следующая перезагрузка страницы попробует снова.
            return
          }
          await new Promise((resolve) => setTimeout(resolve, ME_RETRY_DELAYS_MS[attempt]))
        }
      }
    }

    checkStoredToken().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginRequest(email, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    // Гостевые избранное/прогресс (если есть) переносятся в аккаунт до того,
    // как компоненты начнут читать данные под новым токеном — см. services/migration
    await migrateGuestDataToAccount(res.token)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await registerRequest(name, email, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    await migrateGuestDataToAccount(res.token)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await googleLoginRequest(credential)
    localStorage.setItem(TOKEN_KEY, res.token)
    await migrateGuestDataToAccount(res.token)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!token) return
    // Просто перечитываем — если сеть моргнула, старые данные в контексте
    // и так остаются, лишний разлогин здесь не нужен (в отличие от
    // первоначальной проверки токена, это не единственный источник правды
    // о том, залогинен ли пользователь).
    const me = await meRequest(token).catch(() => null)
    if (me) setUser(me)
  }, [token])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри <AuthProvider>')
  return ctx
}
