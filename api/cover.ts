/*
  Прокси обложек MangaDex — Vercel Edge Function. Доступна как
  /covers/<uuid>/<файл> (rewrite в vercel.json), отдаёт то, что лежит на
  https://uploads.mangadex.org/covers/<uuid>/<файл>.

  Зачем: CDN uploads.mangadex.org отвечает браузерам чужих сайтов 403
  "Bot challenge not passed" (защита от хотлинка; правила MangaDex требуют
  проксировать запросы пользователей, см. https://api.mangadex.org/docs/2-limitations/).
  Сервер ходит с честным User-Agent MangaGreen/1.0 (без подмены, без Via) и
  получает обычный ответ.

  Правила этой функции:
    - БЕЛЫЙ СПИСОК: только /covers/<uuid>/<uuid>.<jpg|jpeg|png|gif|webp>[.256.jpg|.512.jpg].
      Ничего больше проксировать нельзя — это не открытый прокси и не
      страницы глав.
    - КЭШ НА КРАЮ: успех — "public, max-age=31536000, s-maxage=31536000,
      immutable" (имя файла обложки меняется при замене обложки, содержимое
      по адресу не меняется). Сюда доходят только промахи кэша.
    - ОШИБКА MangaDex: пустой ответ (404 для 404, иначе 502), кэш отказа на
      краю 60 секунд (s-maxage=60), в браузере не кэшируется (кнопка
      "Повторить" должна реально повторять). Повторных запросов к MangaDex
      из функции НЕТ — ровно одна попытка.
    - ПРОТИВ ПЕРЕБОРА uuid: каждый промах — это запрос к MangaDex, поэтому
      на промахи действует мягкий лимит на IP (в памяти экземпляра функции;
      он на экземпляр и регион, это не глобальная гарантия) и обязательно
      правило Vercel WAF Rate Limiting на /covers/* (см. HANDOFF.md).
    - Копий нигде не храним (ни R2, ни диск): только кэш CDN Vercel.
*/

export const config = { runtime: 'edge' }

const UPSTREAM = 'https://uploads.mangadex.org/covers'
const USER_AGENT = 'MangaGreen/1.0 (+https://www.mangagreen.com)'
const UPSTREAM_TIMEOUT_MS = 8000
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const ID_RE = new RegExp(`^${UUID}$`)
const FILE_RE = new RegExp(`^${UUID}\\.(?:jpg|jpeg|png|gif|webp)(?:\\.(?:256|512)\\.jpg)?$`)

const SUCCESS_CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable'
// Отказ: на краю 60 с, в браузере не кэшируем.
const FAILURE_CACHE = 'public, max-age=0, s-maxage=60'

// Мягкий лимит промахов на IP: в пределах одного экземпляра функции.
const MISS_LIMIT_PER_MIN = 120
const missWindow = new Map<string, { count: number; resetAt: number }>()

function allowMiss(ip: string, now = Date.now()): boolean {
  if (missWindow.size > 2000) {
    for (const [k, v] of missWindow) if (v.resetAt <= now) missWindow.delete(k)
  }
  const cur = missWindow.get(ip)
  if (!cur || cur.resetAt <= now) {
    missWindow.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (cur.count >= MISS_LIMIT_PER_MIN) return false
  cur.count += 1
  return true
}

function empty(status: number, extra: Record<string, string> = {}): Response {
  return new Response(null, {
    status,
    headers: { 'cache-control': FAILURE_CACHE, 'x-content-type-options': 'nosniff', ...extra },
  })
}

/** Разбор и проверка пути. null — не по белому списку. */
function parseCoverRequest(id: string | null, file: string | null): { id: string; file: string } | null {
  if (!id || !file) return null
  if (!ID_RE.test(id) || !FILE_RE.test(file)) return null
  return { id, file }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return empty(405, { allow: 'GET, HEAD' })

  const url = new URL(request.url)
  const parsed = parseCoverRequest(url.searchParams.get('id'), url.searchParams.get('file'))
  // Не по белому списку: короткий кэш отказа, чтобы повторы не доходили до функции.
  if (!parsed) return empty(404)

  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!allowMiss(ip)) return empty(429, { 'retry-after': '60' })

  let upstream: Response
  try {
    // Ровно одна попытка, без повторов. Referer не передаём, Via не добавляем.
    upstream = await fetch(`${UPSTREAM}/${parsed.id}/${parsed.file}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'image/*' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return empty(502)
  }

  const type = upstream.headers.get('content-type') ?? ''
  if (!upstream.ok || !type.startsWith('image/')) {
    await upstream.body?.cancel().catch(() => {})
    return empty(upstream.status === 404 ? 404 : 502)
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': type,
      'cache-control': SUCCESS_CACHE,
      'x-content-type-options': 'nosniff',
      // Картинка подключается с нашего же домена, но пусть её можно встраивать и из Telegram/превью.
      'cross-origin-resource-policy': 'cross-origin',
    },
  })
}
