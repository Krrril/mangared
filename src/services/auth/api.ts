const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

/*
  Бесплатный план Render "усыпляет" backend после ~15 минут без запросов —
  первый реальный запрос после паузы может занять до ~50 секунд, и
  выглядит это как "форма зависла" (см. DECISIONS.md). pingServer()
  дёргает /health в фоне сразу при открытии страницы входа — не ждём
  ответа, просто даём серверу шанс проснуться заранее, пока пользователь
  ещё вводит email и пароль.
*/
export function pingServer(): void {
  const origin = API_BASE.replace(/\/api\/?$/, '')
  fetch(`${origin}/health`).catch(() => {})
}

export interface AuthUser {
  id: string
  email: string
  name: string
  isAdmin: boolean
}

interface AuthResponse {
  token: string
  user: AuthUser
}

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error ?? `Ошибка сервера (${res.status})`)
  }
  return data
}

export async function registerRequest(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  return parseJsonOrThrow(res)
}

export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return parseJsonOrThrow(res)
}

/** credential — ID-токен, который отдаёт Google Identity Services после входа */
export async function googleLoginRequest(credential: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  return parseJsonOrThrow(res)
}

export async function meRequest(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseJsonOrThrow(res)
}

/** Общий fetch с токеном — используют services/favorites и services/progress для запросов к бэкенду. */
export async function authorizedFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })
  return parseJsonOrThrow(res)
}
