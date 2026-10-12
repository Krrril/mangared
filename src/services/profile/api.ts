import { API_BASE } from '../../config/api'

/*
  Настройки профиля: ник (@username) и имя. Сервер отвечает не только
  текстом ошибки, но и машинным code (см. services/identity.ts на
  бэкенде) — по нему страница настроек показывает переведённое
  сообщение, а не русский текст из ответа.
*/

export interface IdentityLimits {
  usernameMin: number
  usernameMax: number
  nameMin: number
  nameMax: number
  usernameCooldownDays: number
  nameCooldownDays: number
  usernameHoldDays: number
}

export interface IdentityState {
  /** null — у пользователя ещё нет профиля (старый аккаунт): ник выдаётся при первой смене. */
  username: string | null
  name: string
  usernameChangedAt: string | null
  nameChangedAt: string | null
  /** true — ник ещё ни разу не менялся: первая смена без ожидания. */
  usernameAutoAssigned: boolean
  usernameNextChangeAt: string | null
  nameNextChangeAt: string | null
  canChangeUsername: boolean
  canChangeName: boolean
  limits: IdentityLimits
}

export type UsernameAvailability =
  | { available: true; reason?: 'same' }
  | { available: false; reason: 'invalid' | 'unavailable' }

export class ProfileApiError extends Error {
  status: number
  code?: string
  nextChangeAt?: string
  constructor(message: string, status: number, code?: string, nextChangeAt?: string) {
    super(message)
    this.status = status
    this.code = code
    this.nextChangeAt = nextChangeAt
  }
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ProfileApiError(data.error ?? `HTTP ${res.status}`, res.status, data.code, data.nextChangeAt)
  }
  return data as T
}

export function fetchIdentity(token: string): Promise<IdentityState> {
  return request('/profile/identity', token)
}

export function checkUsernameAvailable(token: string, username: string, signal?: AbortSignal): Promise<UsernameAvailability> {
  return request(`/profile/username-available?username=${encodeURIComponent(username)}`, token, { signal })
}

export function changeUsername(token: string, username: string): Promise<IdentityState> {
  return request('/profile/username', token, { method: 'PATCH', body: JSON.stringify({ username }) })
}

export function changeName(token: string, name: string): Promise<IdentityState> {
  return request('/profile/name', token, { method: 'PATCH', body: JSON.stringify({ name }) })
}
