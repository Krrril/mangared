/*
  Клиент Telegram Bot API — ТОЛЬКО отправка (sendMessage, sendPhoto,
  sendMediaGroup, deleteMessage). Webhook не используется, входящие
  сообщения не принимаются.

  Настройки — только переменные окружения (на Render), в коде/репозитории/
  логах/ответах API их значений нет:
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
    TELEGRAM_POST_ENABLED  — "true" включает автопубликацию (по умолчанию выключено)
    TELEGRAM_POST_LANG     — язык постов, ru (по умолчанию) или en
    TELEGRAM_DIGEST_COVERS — "true" — подборка с обложками MangaDex (по умолчанию false)
    TELEGRAM_ORIGINALS_COVERS — "true" — посты об Originals с обложкой автора
      (по умолчанию false: пользовательское соглашение не разрешает показ
      обложек за пределами сайта, см. HANDOFF.md)
    CRON_SECRET            — секрет для POST /api/internal/telegram-digest

  Ошибки Telegram НИКОГДА не выбрасываются наружу: каждая функция
  возвращает { ok: false, error }, а вызывающий код (одобрение тайтла,
  публикация главы) вообще не ждёт результата и не зависит от него.
*/

const API_ROOT = 'https://api.telegram.org'
/** Минимальная пауза между любыми двумя отправками (лимиты Telegram для каналов). */
const MIN_GAP_MS = Number(process.env.TELEGRAM_MIN_GAP_MS ?? 3000)
const MAX_RETRIES_ON_429 = 3
const REQUEST_TIMEOUT_MS = 20_000

export type TelegramLang = 'ru' | 'en'

export interface TelegramConfig {
  token: string | null
  channelId: string | null
  enabled: boolean
  lang: TelegramLang
  digestCovers: boolean
  originalsCovers: boolean
  cronSecret: string | null
  siteUrl: string
}

const truthy = (v: string | undefined) => v?.trim().toLowerCase() === 'true'

export function telegramConfig(): TelegramConfig {
  const lang = process.env.TELEGRAM_POST_LANG?.trim().toLowerCase() === 'en' ? 'en' : 'ru'
  return {
    token: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
    channelId: process.env.TELEGRAM_CHANNEL_ID?.trim() || null,
    enabled: truthy(process.env.TELEGRAM_POST_ENABLED),
    lang,
    digestCovers: truthy(process.env.TELEGRAM_DIGEST_COVERS),
    originalsCovers: truthy(process.env.TELEGRAM_ORIGINALS_COVERS),
    cronSecret: process.env.CRON_SECRET?.trim() || null,
    siteUrl: (process.env.SITE_URL?.trim() || 'https://www.mangagreen.com').replace(/\/+$/, ''),
  }
}

/** Токен и канал заданы (хватает для тестовых отправок из админки). */
export function isConfigured(cfg = telegramConfig()): boolean {
  return !!cfg.token && !!cfg.channelId
}

/** Автопубликация включена: флаг + токен + канал. Иначе сайт работает как раньше. */
export function isPostingEnabled(cfg = telegramConfig()): boolean {
  return cfg.enabled && isConfigured(cfg)
}

/** Убирает токен из любой строки, которая может попасть в лог/ответ. */
export function redact(text: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  let out = text
  if (token) out = out.split(token).join('***')
  // На случай, если в тексте ошибки окажется URL запроса с токеном другого бота.
  return out.replace(/bot\d{5,}:[A-Za-z0-9_-]{20,}/g, 'bot***')
}

export function logTelegram(message: string, extra?: unknown): void {
  const tail = extra instanceof Error ? ` ${extra.message}` : extra !== undefined ? ` ${String(extra)}` : ''
  console.error(redact(`[telegram] ${message}${tail}`))
}

/** Экранирование для parse_mode=HTML (текст и значения атрибутов). */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type SendResult = { ok: true; messageIds: number[] } | { ok: false; error: string }

interface BotResponse {
  ok: boolean
  result?: unknown
  description?: string
  error_code?: number
  parameters?: { retry_after?: number }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Все отправки идут по одной очереди с паузой MIN_GAP_MS между запросами.
let chain: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      return await task()
    } finally {
      lastRequestAt = Date.now()
    }
  })
  chain = run.catch(() => undefined)
  return run
}

async function callBot(method: string, payload: Record<string, unknown>): Promise<BotResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN не задан' }
  try {
    const res = await fetch(`${API_ROOT}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const data = (await res.json().catch(() => null)) as BotResponse | null
    if (!data) return { ok: false, error_code: res.status, description: `HTTP ${res.status}` }
    return data
  } catch (err) {
    // Текст сетевой ошибки может содержать URL с токеном — чистим.
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, description: redact(`network error: ${msg}`) }
  }
}

/** Один вызов Bot API с паузой между запросами и повтором при 429 с учётом retry_after. */
async function send(method: string, payload: Record<string, unknown>): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  return enqueue(async () => {
    for (let attempt = 0; ; attempt++) {
      const data = await callBot(method, payload)
      if (data.ok) return { ok: true as const, result: data.result }
      if (data.error_code === 429 && attempt < MAX_RETRIES_ON_429) {
        const retryAfter = Math.min(Math.max(data.parameters?.retry_after ?? 5, 1), 120)
        logTelegram(`${method}: 429, повтор через ${retryAfter} с`)
        await sleep((retryAfter + 1) * 1000)
        continue
      }
      const error = redact(`${data.error_code ?? ''} ${data.description ?? 'unknown error'}`.trim())
      logTelegram(`${method} failed:`, error)
      return { ok: false as const, error }
    }
  })
}

interface CommonOptions {
  chatId?: string
  /** true — без звука (тестовые отправки). */
  silent?: boolean
}

function chat(opts: CommonOptions): string | null {
  return opts.chatId ?? telegramConfig().channelId
}

export async function sendMessage(text: string, opts: CommonOptions = {}): Promise<SendResult> {
  const chat_id = chat(opts)
  if (!chat_id) return { ok: false, error: 'TELEGRAM_CHANNEL_ID не задан' }
  const r = await send('sendMessage', {
    chat_id,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    disable_notification: opts.silent === true,
  })
  if (!r.ok) return r
  const id = (r.result as { message_id?: number } | null)?.message_id
  return { ok: true, messageIds: typeof id === 'number' ? [id] : [] }
}

export async function sendPhoto(photoUrl: string, caption: string, opts: CommonOptions = {}): Promise<SendResult> {
  const chat_id = chat(opts)
  if (!chat_id) return { ok: false, error: 'TELEGRAM_CHANNEL_ID не задан' }
  const r = await send('sendPhoto', {
    chat_id,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
    disable_notification: opts.silent === true,
  })
  if (!r.ok) return r
  const id = (r.result as { message_id?: number } | null)?.message_id
  return { ok: true, messageIds: typeof id === 'number' ? [id] : [] }
}

/** Альбом (2–10 фото по URL). Подпись — только у первого фото (так её показывает Telegram). */
export async function sendMediaGroup(photoUrls: string[], caption: string, opts: CommonOptions = {}): Promise<SendResult> {
  const chat_id = chat(opts)
  if (!chat_id) return { ok: false, error: 'TELEGRAM_CHANNEL_ID не задан' }
  const urls = photoUrls.slice(0, 10)
  if (urls.length < 2) {
    return urls.length === 1 ? sendPhoto(urls[0], caption, opts) : { ok: false, error: 'нет изображений' }
  }
  const media = urls.map((url, i) => ({ type: 'photo', media: url, ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}) }))
  const r = await send('sendMediaGroup', { chat_id, media, disable_notification: opts.silent === true })
  if (!r.ok) return r
  const ids = ((r.result as { message_id?: number }[] | null) ?? []).map((m) => m.message_id).filter((x): x is number => typeof x === 'number')
  return { ok: true, messageIds: ids }
}

export async function deleteMessage(messageId: number, opts: CommonOptions = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  const chat_id = chat(opts)
  if (!chat_id) return { ok: false, error: 'TELEGRAM_CHANNEL_ID не задан' }
  const r = await send('deleteMessage', { chat_id, message_id: messageId })
  return r.ok ? { ok: true } : r
}
