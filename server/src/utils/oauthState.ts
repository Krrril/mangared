import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'

/*
  CSRF-защита для redirect-based OAuth (сейчас — только Яндекс, см.
  routes/auth.ts): классический подход хранил бы случайный state в
  сессии/cookie и сверял его при возврате, но у этого бэкенда нет вообще
  никакой серверной сессии (только Bearer JWT в заголовке) — заводить её
  ради одного redirect-флоу не стоит. Вместо этого сам state — короткоживущий
  подписанный JWT (тем же JWT_SECRET, что и обычные токены входа, но с
  собственным типом payload) — подделать его без секрета нельзя, а
  проверка не требует никакого хранилища на сервере между /start и /callback.
*/

const secret = process.env.JWT_SECRET
if (!secret) {
  throw new Error('JWT_SECRET is not set — проверь server/.env (см. .env.example)')
}
const JWT_SECRET: string = secret

const STATE_TTL = '10m'

export function signOauthState(provider: string): string {
  return jwt.sign({ provider, nonce: randomUUID() }, JWT_SECRET, { expiresIn: STATE_TTL })
}

export function verifyOauthState(state: string, provider: string): boolean {
  try {
    const decoded = jwt.verify(state, JWT_SECRET)
    return typeof decoded === 'object' && decoded.provider === provider
  } catch {
    return false
  }
}
