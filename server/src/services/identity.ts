import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { containsProfanity } from '../constants/profanity.js'
import { isReservedUsername } from '../constants/reservedUsernames.js'

/*
  Ник (@username) и имя пользователя — вся логика смены в одном месте, чтобы
  самостоятельная смена (routes/profile.ts), принудительная смена админом
  (routes/admin.ts) и автоматическая выдача ника при регистрации
  (routes/auth.ts, routes/originals.ts) подчинялись одним и тем же правилам.

  Модель:
    - юзернейм живёт на AuthorProfile.username (URL /author/<ник>), у
      каждого зарегистрированного пользователя профиль есть с первого дня;
    - имя — User.name, копия в AuthorProfile.displayName пишется в той же
      транзакции (публичные ответы читают именно displayName, поэтому
      комментарии, карточки, поиск авторов и уведомления берут имя из
      профиля, а не копируют его в свои строки);
    - User.usernameChangedAt / nameChangedAt — когда последний раз менял
      сам пользователь (null — ещё не менял, ограничения по времени нет).
*/

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
export const NAME_MIN = 2
export const NAME_MAX = 30

const DAY_MS = 24 * 60 * 60 * 1000
export const USERNAME_COOLDOWN_MS = 30 * DAY_MS
export const NAME_COOLDOWN_MS = 7 * DAY_MS
// Сколько дней старый ник нельзя взять другому пользователю.
export const USERNAME_HOLD_MS = 90 * DAY_MS

const USERNAME_RE = new RegExp(`^[a-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}}$`)

export type IdentityErrorCode =
  | 'invalid_username'
  | 'username_unavailable'
  | 'invalid_name'
  | 'name_unavailable'
  | 'cooldown'
  | 'not_found'

export class IdentityError extends Error {
  constructor(
    public code: IdentityErrorCode,
    public status: number,
    message: string,
    public nextChangeAt?: Date,
  ) {
    super(message)
  }
}

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase()
}

export function isValidUsernameFormat(username: string): boolean {
  return USERNAME_RE.test(username)
}

/** Транслитерация (ru/uk/kk) — для автоматической выдачи ника из имени. */
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  є: 'ye', і: 'i', ї: 'yi', ґ: 'g',
  ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h',
}

/** "Кирилл" → "kirill"; всё, что не латиница/цифры, превращается в "_" (без повторов и по краям). */
export function slugifyForUsername(input: string): string {
  const latin = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
  return latin
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, USERNAME_MAX)
    .replace(/_+$/g, '')
}

// ---------------------------------------------------------------------------
// Доступность ника
// ---------------------------------------------------------------------------

/**
 * Занят ли ник другим пользователем: активный профиль (без учёта регистра —
 * старые записи могли быть не в нижнем регистре) либо ник из истории, не
 * старше 90 дней (чужой старый ник держим в резерве).
 */
export async function isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
  const active = await prisma.authorProfile.findFirst({
    where: { username: { equals: username, mode: 'insensitive' }, ...(exceptUserId ? { NOT: { userId: exceptUserId } } : {}) },
    select: { id: true },
  })
  if (active) return true
  const held = await prisma.usernameHistory.findFirst({
    where: {
      oldUsername: username.toLowerCase(),
      changedAt: { gt: new Date(Date.now() - USERNAME_HOLD_MS) },
      ...(exceptUserId ? { NOT: { userId: exceptUserId } } : {}),
    },
    select: { id: true },
  })
  return !!held
}

/**
 * Один общий ответ "недоступен" для занятого/зарезервированного/в резерве/
 * нецензурного ника — чтобы эндпоинт проверки не показывал, КТО именно и
 * почему держит ник (и не превращался в список пользователей).
 */
export async function usernameProblem(
  candidate: string,
  opts: { exceptUserId?: string; adminOverride?: boolean } = {},
): Promise<null | 'invalid' | 'unavailable'> {
  if (!isValidUsernameFormat(candidate)) return 'invalid'
  if (!opts.adminOverride) {
    if (isReservedUsername(candidate)) return 'unavailable'
    if (containsProfanity(candidate) || containsTranslitProfanity(candidate)) return 'unavailable'
  }
  if (await isUsernameTaken(candidate, opts.exceptUserId)) return 'unavailable'
  return null
}

// Транслитерированный мат — только корни, у которых почти нет невинных
// совпадений (не "huy": это обычное вьетнамское имя; не "suka"/"ebat":
// "tsukasa", "debate"). Основной фильтр — containsProfanity, как в комментариях.
const TRANSLIT_PROFANITY = ['pizd', 'blyad', 'blyat', 'pidor', 'pidar', 'mudak', 'zalup', 'gandon', 'eblan', 'ebanat']

function containsTranslitProfanity(username: string): boolean {
  const flat = username.replace(/_/g, '')
  return TRANSLIT_PROFANITY.some((w) => flat.includes(w))
}

/** Подбирает свободный ник, подходящий под правила (для регистрации через Google/Яндекс и для старых пользователей без профиля). */
export async function suggestUniqueUsername(base: string): Promise<string> {
  let root = slugifyForUsername(base)
  if (root.length < USERNAME_MIN) root = `user_${root}`.replace(/_+$/g, '')
  if (root.length < USERNAME_MIN) root = 'user'

  const problemFree = async (candidate: string) => (await usernameProblem(candidate)) === null
  if (await problemFree(root)) return root

  for (let n = 1; n <= 50; n++) {
    const suffix = `_${n}`
    const candidate = `${root.slice(0, USERNAME_MAX - suffix.length)}${suffix}`
    if (await problemFree(candidate)) return candidate
  }
  // Крайний случай (всё занято/зарезервировано) — случайные цифры.
  for (;;) {
    const candidate = `user${Math.floor(10000 + Math.random() * 90000)}`
    if (await problemFree(candidate)) return candidate
  }
}

// ---------------------------------------------------------------------------
// Имя
// ---------------------------------------------------------------------------

// Управляющие, форматирующие (в т.ч. zero-width и bidi-override), суррогаты,
// неназначенные и "частные" символы, разделители строк/абзацев.
const CONTROL_CHARS_RE = /[\p{C}\p{Zl}\p{Zp}]/u
// Ссылки: схема, www., t.me/..., либо слово.домен с популярной зоной (без
// общего "слово.слово" — иначе "Mr.Smith" и "J.K.Rowling" считались бы ссылками).
const LINK_RE =
  /(https?:\/\/|www\.|\bt\.me\b|\b[\p{L}\p{N}-]+\.(com|net|org|ru|io|me|app|xyz|ly|gg|tv|kz|ua|by|su|info|biz|co|pro|site|online|club|top|dev|to|cc|ws|link|shop|store|tk|ml)\b)/iu

export function stripUnsafeNameChars(raw: string): string {
  return raw.normalize('NFC').replace(/[\p{C}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Проверка и нормализация имени при смене пользователем. Возвращает чистую строку либо бросает IdentityError. */
export function validateName(raw: string, opts: { adminOverride?: boolean } = {}): string {
  if (CONTROL_CHARS_RE.test(raw.replace(/\s/g, ' '))) {
    throw new IdentityError('invalid_name', 400, 'Имя содержит недопустимые символы')
  }
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  const length = [...name].length
  if (length < NAME_MIN || length > NAME_MAX) {
    throw new IdentityError('invalid_name', 400, `Имя — от ${NAME_MIN} до ${NAME_MAX} символов`)
  }
  if (LINK_RE.test(name)) {
    throw new IdentityError('invalid_name', 400, 'В имени нельзя указывать ссылки')
  }
  if (!opts.adminOverride) {
    if (containsProfanity(name) || isReservedUsername(name)) {
      throw new IdentityError('name_unavailable', 409, 'Это имя недоступно')
    }
  }
  return name
}

/** Для имён из Google/Яндекс при регистрации: не отказываем, а приводим к допустимому виду. */
export function sanitizeOauthName(raw: string | undefined | null, fallback: string): string {
  const cleaned = stripUnsafeNameChars(raw ?? '')
  const cut = [...cleaned].slice(0, NAME_MAX).join('').trim()
  if ([...cut].length >= NAME_MIN && !LINK_RE.test(cut)) return cut
  const fb = stripUnsafeNameChars(fallback)
  return [...fb].slice(0, NAME_MAX).join('').trim() || 'User'
}

// ---------------------------------------------------------------------------
// Состояние и смена
// ---------------------------------------------------------------------------

export interface IdentityActor {
  type: 'user' | 'admin'
  id?: string
}

export function nextChangeAt(lastChangedAt: Date | null, cooldownMs: number): Date | null {
  if (!lastChangedAt) return null
  const next = new Date(lastChangedAt.getTime() + cooldownMs)
  return next.getTime() > Date.now() ? next : null
}

export async function getIdentityState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, usernameChangedAt: true, nameChangedAt: true, authorProfile: { select: { username: true, displayName: true } } },
  })
  if (!user) return null
  const usernameNext = nextChangeAt(user.usernameChangedAt, USERNAME_COOLDOWN_MS)
  const nameNext = nextChangeAt(user.nameChangedAt, NAME_COOLDOWN_MS)
  return {
    username: user.authorProfile?.username ?? null,
    // То, что видят другие люди, — displayName; у старых пользователей без
    // профиля — User.name.
    name: user.authorProfile?.displayName ?? user.name,
    usernameChangedAt: user.usernameChangedAt,
    nameChangedAt: user.nameChangedAt,
    usernameAutoAssigned: user.usernameChangedAt === null,
    usernameNextChangeAt: usernameNext,
    nameNextChangeAt: nameNext,
    canChangeUsername: usernameNext === null,
    canChangeName: nameNext === null,
    limits: {
      usernameMin: USERNAME_MIN,
      usernameMax: USERNAME_MAX,
      nameMin: NAME_MIN,
      nameMax: NAME_MAX,
      usernameCooldownDays: USERNAME_COOLDOWN_MS / DAY_MS,
      nameCooldownDays: NAME_COOLDOWN_MS / DAY_MS,
      usernameHoldDays: USERNAME_HOLD_MS / DAY_MS,
    },
  }
}

export interface ChangeOptions {
  actor: IdentityActor
  /** Админ: игнорирует 30/7-дневный лимит, резервные слова и фильтр мата. */
  bypass?: boolean
}

export async function changeUsername(userId: string, rawUsername: string, opts: ChangeOptions): Promise<{ username: string; changed: boolean }> {
  const candidate = normalizeUsername(rawUsername)
  const bypass = opts.bypass === true

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, usernameChangedAt: true, authorProfile: { select: { id: true, username: true } } },
  })
  if (!user) throw new IdentityError('not_found', 404, 'Пользователь не найден')

  if (user.authorProfile && user.authorProfile.username.toLowerCase() === candidate) {
    // Тот же ник (возможно, другим регистром) — ничего не делаем.
    return { username: user.authorProfile.username, changed: false }
  }

  if (!bypass) {
    const next = nextChangeAt(user.usernameChangedAt, USERNAME_COOLDOWN_MS)
    if (next) throw new IdentityError('cooldown', 429, 'Ник можно менять не чаще раза в 30 дней', next)
  }

  const problem = await usernameProblem(candidate, { exceptUserId: userId, adminOverride: bypass })
  if (problem === 'invalid') {
    throw new IdentityError('invalid_username', 400, `Ник: ${USERNAME_MIN}–${USERNAME_MAX} символов, латиница, цифры и подчёркивание`)
  }
  if (problem === 'unavailable') {
    throw new IdentityError('username_unavailable', 409, 'Этот ник недоступен')
  }

  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      if (user.authorProfile) {
        await tx.authorProfile.update({ where: { id: user.authorProfile.id }, data: { username: candidate } })
        await tx.usernameHistory.create({
          data: { userId, oldUsername: user.authorProfile.username.toLowerCase(), newUsername: candidate, changedAt: now },
        })
      } else {
        await tx.authorProfile.create({ data: { userId, username: candidate, displayName: user.name } })
      }
      // Если пользователь вернул себе свой же старый ник — редирект с него
      // больше не нужен (активный профиль всё равно приоритетнее истории).
      await tx.usernameHistory.deleteMany({ where: { userId, oldUsername: candidate } })
      if (opts.actor.type === 'user') {
        await tx.user.update({ where: { id: userId }, data: { usernameChangedAt: now } })
      }
      await tx.identityChangeLog.create({
        data: {
          userId,
          field: 'username',
          oldValue: user.authorProfile?.username ?? null,
          newValue: candidate,
          actorType: opts.actor.type,
          actorId: opts.actor.id ?? null,
        },
      })
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Уникальный индекс сработал между проверкой и записью — кто-то успел раньше.
      throw new IdentityError('username_unavailable', 409, 'Этот ник недоступен')
    }
    throw err
  }
  return { username: candidate, changed: true }
}

export async function changeName(userId: string, rawName: string, opts: ChangeOptions): Promise<{ name: string; changed: boolean }> {
  const bypass = opts.bypass === true
  const name = validateName(rawName, { adminOverride: bypass })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, nameChangedAt: true, authorProfile: { select: { id: true, displayName: true } } },
  })
  if (!user) throw new IdentityError('not_found', 404, 'Пользователь не найден')

  const current = user.authorProfile?.displayName ?? user.name
  if (current === name && user.name === name) return { name, changed: false }

  if (!bypass) {
    const next = nextChangeAt(user.nameChangedAt, NAME_COOLDOWN_MS)
    if (next) throw new IdentityError('cooldown', 429, 'Имя можно менять не чаще раза в 7 дней', next)
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { name, ...(opts.actor.type === 'user' ? { nameChangedAt: now } : {}) },
    })
    if (user.authorProfile) {
      await tx.authorProfile.update({ where: { id: user.authorProfile.id }, data: { displayName: name } })
    }
    await tx.identityChangeLog.create({
      data: { userId, field: 'name', oldValue: current, newValue: name, actorType: opts.actor.type, actorId: opts.actor.id ?? null },
    })
  })
  return { name, changed: true }
}

/** Сбросить оба ограничения по времени (админ): ближайшая смена ника и имени — без ожидания. */
export async function resetIdentityLimits(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { usernameChangedAt: null, nameChangedAt: null } })
}

// ---------------------------------------------------------------------------
// Поиск автора по нику, в т.ч. по старому
// ---------------------------------------------------------------------------

export type AuthorLookup =
  | { kind: 'found'; username: string }
  | { kind: 'redirect'; username: string }
  | { kind: 'missing' }

/**
 * Ник из URL → актуальный ник. Порядок: точное совпадение; то же без учёта
 * регистра (редирект на правильный регистр); история (редирект на ТЕКУЩИЙ
 * ник того же пользователя — цепочки старый→средний→новый сворачиваются).
 */
export async function lookupAuthorUsername(rawUsername: string): Promise<AuthorLookup> {
  const exact = await prisma.authorProfile.findUnique({ where: { username: rawUsername }, select: { username: true } })
  if (exact) return { kind: 'found', username: exact.username }

  const insensitive = await prisma.authorProfile.findFirst({
    where: { username: { equals: rawUsername, mode: 'insensitive' } },
    select: { username: true },
  })
  if (insensitive) return { kind: 'redirect', username: insensitive.username }

  const history = await prisma.usernameHistory.findFirst({
    where: { oldUsername: rawUsername.toLowerCase() },
    orderBy: { changedAt: 'desc' },
    select: { user: { select: { authorProfile: { select: { username: true } } } } },
  })
  const current = history?.user.authorProfile?.username
  if (current) return { kind: 'redirect', username: current }

  return { kind: 'missing' }
}
