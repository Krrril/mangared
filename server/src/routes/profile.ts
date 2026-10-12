import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import {
  IdentityError,
  changeName,
  changeUsername,
  getIdentityState,
  isValidUsernameFormat,
  normalizeUsername,
  usernameProblem,
} from '../services/identity.js'

/*
  Настройки профиля: ник (@username) и имя. Всё работает только над СВОИМ
  аккаунтом — id берётся из токена, а не из пути/тела, поэтому "чужой
  профиль" через этот роутер не изменить в принципе (принудительная смена
  админом — отдельный эндпоинт в routes/admin.ts за requireAdmin).
*/

export const profileRouter = Router()

profileRouter.use(requireAuth)

const keyByUser = (req: Request) => req.userId ?? 'anonymous'

// Express 4 не ловит отклонённые промисы async-обработчиков сам — без
// этой обёртки неожиданная ошибка БД повисла бы запросом без ответа.
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }

// Проверка доступности вызывается при вводе (с дебаунсом на клиенте) — лимит
// щедрый для обычного набора, но не даёт перебирать ники скриптом.
const availabilityLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Слишком много проверок, подождите минуту', code: 'rate_limited' },
})

// Смены (даже неудачные) — не чаще 10 в час на пользователя, поверх
// 30-/7-дневных ограничений: это защита от перебора ников через PATCH.
const changeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Слишком много попыток, попробуйте позже', code: 'rate_limited' },
})

function sendIdentityError(res: Response, err: unknown): boolean {
  if (err instanceof IdentityError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.nextChangeAt ? { nextChangeAt: err.nextChangeAt.toISOString() } : {}),
    })
    return true
  }
  return false
}

profileRouter.get('/identity', wrap(async (req, res) => {
  const state = await getIdentityState(req.userId!)
  if (!state) {
    res.status(404).json({ error: 'Пользователь не найден', code: 'not_found' })
    return
  }
  res.json(state)
}))

const availabilityQuery = z.object({ username: z.string().max(64) })

/**
 * Свободен ли ник. Ответ намеренно один: available true/false и причина
 * только "invalid" (формат — это ошибка самого ввода) либо "unavailable"
 * (занят, в резерве, зарезервирован или недопустим — не уточняем, чтобы
 * эндпоинт не раскрывал, чей это ник и почему).
 */
profileRouter.get('/username-available', availabilityLimiter, wrap(async (req, res) => {
  const parsed = availabilityQuery.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные параметры запроса', code: 'invalid_username' })
    return
  }
  const candidate = normalizeUsername(parsed.data.username)
  if (!isValidUsernameFormat(candidate)) {
    res.json({ available: false, reason: 'invalid' })
    return
  }
  const state = await getIdentityState(req.userId!)
  if (state?.username && state.username.toLowerCase() === candidate) {
    res.json({ available: true, reason: 'same' })
    return
  }
  const problem = await usernameProblem(candidate, { exceptUserId: req.userId })
  res.json(problem === null ? { available: true } : { available: false, reason: problem })
}))

const usernameBody = z.object({ username: z.string().max(64) })

profileRouter.patch('/username', changeLimiter, wrap(async (req, res) => {
  const parsed = usernameBody.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные данные', code: 'invalid_username' })
    return
  }
  try {
    await changeUsername(req.userId!, parsed.data.username, { actor: { type: 'user' } })
    res.json(await getIdentityState(req.userId!))
  } catch (err) {
    if (!sendIdentityError(res, err)) throw err
  }
}))

const nameBody = z.object({ name: z.string().max(200) })

profileRouter.patch('/name', changeLimiter, wrap(async (req, res) => {
  const parsed = nameBody.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректные данные', code: 'invalid_name' })
    return
  }
  try {
    await changeName(req.userId!, parsed.data.name, { actor: { type: 'user' } })
    res.json(await getIdentityState(req.userId!))
  } catch (err) {
    if (!sendIdentityError(res, err)) throw err
  }
}))
