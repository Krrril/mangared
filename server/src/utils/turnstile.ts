/*
  Cloudflare Turnstile — проверка токена с виджета на форме регистрации
  (см. src/components/TurnstileWidget.tsx). Секретный ключ — только на
  бэкенде, никогда не уходит на фронтенд (в отличие от публичного site key).
*/

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const secretKey = process.env.TURNSTILE_SECRET_KEY

/** Настроен ли Turnstile на этом сервере вообще — если нет, проверку в вызывающем коде пропускают целиком (см. routes/auth.ts). */
export function isTurnstileConfigured(): boolean {
  return !!secretKey
}

/**
 * true — токен настоящий и ещё не использован (Cloudflare одноразово
 * гасит токен при первой успешной проверке, повторно предъявить тот же
 * токен не получится — это уже защита от повтора на стороне Cloudflare,
 * не нужно делать её самим).
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  if (!secretKey) return true // не настроено — не блокируем (см. isTurnstileConfigured)
  if (!token) return false

  const body = new URLSearchParams({ secret: secretKey, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body })
    const data = (await res.json()) as { success: boolean }
    return data.success === true
  } catch (err) {
    console.error('Turnstile verify request failed:', err)
    // Сеть/Cloudflare недоступны — безопаснее отказать, чем молча
    // пропустить регистрацию без проверки (см. isTurnstileConfigured для
    // случая "не настроено вообще", это другой случай).
    return false
  }
}
