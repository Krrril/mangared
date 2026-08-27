import { API_BASE } from '../../config/api'

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
  /** username профиля автора (/author/:username) — null, если профиля ещё нет (публикаций не было) */
  authorUsername: string | null
  /** Аватар из AuthorProfile, если он есть — null, пока профиля автора нет или аватар не загружен */
  avatarUrl: string | null
}

interface AuthResponse {
  token: string
  user: AuthUser
}

/**
 * Отличается от обычной Error полем status — AuthContext по нему решает,
 * правда ли токен невалиден (401/404 от /auth/me), или сервер просто
 * недоступен (сетевая ошибка, 5xx, "холодный" Render) — во втором случае
 * разлогинивать пользователя нельзя, токен ещё живой (см. AuthContext.tsx).
 */
export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error ?? `Ошибка сервера (${res.status})`, res.status)
  }
  return data
}

export async function registerRequest(name: string, email: string, password: string, username: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, username }),
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

export async function forgotPasswordRequest(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  await parseJsonOrThrow(res)
}

export async function resetPasswordRequest(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
  await parseJsonOrThrow(res)
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
