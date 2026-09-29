import { API_BASE } from './constants'

export interface WorkingLanguage {
  code: string
  /** Число читаемых глав на этом языке */
  chapters: number
}

/*
  "Рабочие" языки тайтла MangaDex — только те, на которых есть реально
  читаемая, открывающаяся глава (проверка на backend, см.
  server/src/services/mangadexLanguages.ts), а не просто
  availableTranslatedLanguages (там попадаются языки без единой читаемой
  главы на сайте — внешние ссылки, пустые главы). Результат кэшируется на
  backend на 12 часов, здесь ничего не кэшируем повторно.
*/
export async function getWorkingLanguages(mangaId: string): Promise<WorkingLanguage[]> {
  try {
    const res = await fetch(`${API_BASE}/_languages/${mangaId}`)
    if (!res.ok) return []
    const data = (await res.json()) as { languages: WorkingLanguage[] }
    return data.languages
  } catch {
    return []
  }
}

/**
 * Читатель сообщает, что глава на этом языке не открылась после всех
 * повторов (см. Reader.tsx) — после нескольких таких репортов язык
 * скрывается из списка для всех (см. mangadexLanguages.ts, PROBLEM_THRESHOLD).
 */
export function reportLanguageProblem(mangaId: string, language: string): void {
  fetch(`${API_BASE}/_language-problem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mangaId, language }),
    keepalive: true,
  }).catch(() => {})
}
