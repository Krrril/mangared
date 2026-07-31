import { authorizedFetch } from '../auth/api'

export interface AdminUser {
  id: string
  name: string
  email: string
  createdAt: string
  isAdmin: boolean
  loginMethod: 'email' | 'google' | 'email+google'
}

export type AdminSort = 'createdAt_desc' | 'createdAt_asc'

export async function fetchAdminUsers(token: string, params: { q?: string; sort?: AdminSort } = {}) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.sort) qs.set('sort', params.sort)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return authorizedFetch(`/admin/users${suffix}`, token) as Promise<AdminUser[]>
}
