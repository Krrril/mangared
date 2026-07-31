import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { googleLoginRequest, loginRequest, meRequest, registerRequest, type AuthUser } from './api'
import { TOKEN_KEY } from './token'
import { migrateGuestDataToAccount } from '../migration'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  /** Пока true — идёт проверка сохранённого токена при загрузке приложения */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  logout: () => void
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
    meRequest(initialToken)
      .then(setUser)
      .catch(() => {
        // Токен истёк или невалиден — тихо разлогиниваем, без ошибки на экране
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
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

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри <AuthProvider>')
  return ctx
}
