import { API_BASE } from './constants'

type QueryValue = string | number | boolean | string[] | Record<string, string>

export type QueryParams = Record<string, QueryValue | undefined>

/*
  MangaDex ждёт массивы в виде повторяющихся ключей с "[]" (contentRating[]=safe&contentRating[]=suggestive)
  и вложенные объекты сортировки в виде order[chapter]=asc — обычный
  URLSearchParams этого не умеет, поэтому строим строку запроса вручную.
*/
function buildQueryString(params: QueryParams): string {
  const parts: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue

    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`)
      }
    } else if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        parts.push(`${encodeURIComponent(key)}[${encodeURIComponent(subKey)}]=${encodeURIComponent(subValue)}`)
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }

  return parts.join('&')
}

export async function mdFetch<T>(path: string, params: QueryParams = {}): Promise<T> {
  const qs = buildQueryString(params)
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`MangaDex API ${res.status} ${res.statusText} — ${url}`)
  }
  return res.json() as Promise<T>
}
