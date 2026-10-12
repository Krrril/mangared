/*
  Зарезервированные юзернеймы — нельзя взять через форму регистрации и
  настройки (админ может назначить любой, см. routes/admin.ts). Нужны,
  чтобы никто не выдавал себя за администрацию/сам сайт и чтобы ник не
  совпадал с маршрутом сайта (/author/<ник> сейчас безопасен, но
  это же имя может понадобиться как /<ник> позже).

  Сравнение идёт по нормализованной форме (см. normalizeForReservedCheck):
  регистр не важен, цифры/символы, похожие на буквы, заменяются
  (0→o, 1→l, 3→e, 4→a, 5→s, 7→t, @→a, $→s), подчёркивания и повторы букв
  убираются — "Adm1n", "_admin_", "aaadmin" и "m4ngagreen" совпадают с
  admin/mangagreen.
*/

const ROLE_AND_BRAND_WORDS = [
  'admin',
  'administrator',
  'administration',
  'adm',
  'mangagreen',
  'mangared',
  'support',
  'help',
  'helpdesk',
  'moderator',
  'moderation',
  'mod',
  'mods',
  'staff',
  'team',
  'official',
  'owner',
  'root',
  'system',
  'sysadmin',
  'superuser',
  'security',
  'service',
  'bot',
  'noreply',
  'info',
  'contact',
  'mail',
  'news',
  'blog',
  'telegram',
  'mangadex',
  'null',
  'undefined',
  'anonymous',
  'guest',
  'user',
  'me',
]

// Маршруты сайта и API (см. src/app/App.tsx и server/src/index.ts).
const ROUTE_WORDS = [
  'api',
  'author',
  'authors',
  'catalog',
  'categories',
  'category',
  'search',
  'library',
  'favorites',
  'history',
  'updates',
  'top',
  'auth',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'forgotpassword',
  'resetpassword',
  'privacy',
  'terms',
  'creator',
  'originals',
  'original',
  'title',
  'titles',
  'read',
  'reader',
  'downloads',
  'publishingrules',
  'publishguide',
  'becomeauthor',
  'premium',
  'settings',
  'profile',
  'notifications',
  'comments',
  'stats',
  'assets',
  'static',
  'public',
  'sitemap',
  'robots',
  'favicon',
  'manifest',
  'about',
  'home',
  'index',
  'new',
]

const LEET: Record<string, string> = {
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
}

/**
 * Нормализация для сравнения с резервным списком: см. комментарий в начале
 * файла. "1" может означать и "l" (mangagreen → mangagreen), и "i"
 * (adm1n → admin), поэтому oneAs выбирается вызывающим — isReservedUsername
 * проверяет оба варианта.
 */
export function normalizeForReservedCheck(value: string, oneAs: 'l' | 'i' = 'l'): string {
  const mapped = value
    .toLowerCase()
    .split('')
    .map((ch) => (ch === '1' ? oneAs : (LEET[ch] ?? ch)))
    .join('')
    .replace(/[^a-z]/g, '')
  // "aaadmin" → "admin"; то же применяем и к самому списку, поэтому
  // "mangagreen" (двойное e) сравнивается сам с собой в той же форме.
  return mapped.replace(/(.)\1+/g, '$1')
}

const RESERVED_NORMALIZED = new Set([...ROLE_AND_BRAND_WORDS, ...ROUTE_WORDS].map((w) => normalizeForReservedCheck(w)))

// Подстроки, которые нельзя использовать как часть ника (подмена бренда
// или роли): "mangagreen_official", "the_administrator". "admin" как
// подстроку сознательно НЕ берём — иначе блокировались бы реальные слова
// ("kadminski"); вместо этого "admin" проверяется как начало/конец ника.
const FORBIDDEN_SUBSTRINGS = ['mangagreen', 'administrator', 'moderator'].map((w) => normalizeForReservedCheck(w))
const FORBIDDEN_AFFIXES = ['admin', 'moderator', 'support'].map((w) => normalizeForReservedCheck(w))

export function isReservedUsername(username: string): boolean {
  return isReservedNormalized(normalizeForReservedCheck(username, 'l')) || isReservedNormalized(normalizeForReservedCheck(username, 'i'))
}

function isReservedNormalized(normalized: string): boolean {
  if (!normalized) return false
  if (RESERVED_NORMALIZED.has(normalized)) return true
  if (FORBIDDEN_SUBSTRINGS.some((s) => normalized.includes(s))) return true
  // Начало или конец ника ("admin_kirill", "kirill_admin"); достаточно
  // длинный остаток, чтобы не цеплять случайные слова, начинающиеся на "adm".
  return FORBIDDEN_AFFIXES.some((a) => normalized.startsWith(a) || normalized.endsWith(a))
}
