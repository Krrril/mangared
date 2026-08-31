import ru from './src/i18n/locales/ru.json'
import en from './src/i18n/locales/en.json'
import kk from './src/i18n/locales/kk.json'
import es from './src/i18n/locales/es.json'
import fr from './src/i18n/locales/fr.json'
import de from './src/i18n/locales/de.json'
import tr from './src/i18n/locales/tr.json'
import ko from './src/i18n/locales/ko.json'
import zh from './src/i18n/locales/zh.json'
import ja from './src/i18n/locales/ja.json'

/*
  Сайт — чисто клиентский Vite/React SPA без SSR: без этого middleware
  краулер, который не выполняет JS (Yandex, Baidu, Naver, да и не факт что
  всегда Google), увидел бы только статичный <title> из index.html,
  одинаковый для всех страниц и языков. Здесь мы на лету подставляем в
  отдаваемый HTML настоящие <title>/<meta description>/hreflang для
  конкретной страницы и языка — до того, как до неё вообще доберётся React.
  react-helmet-async (см. SeoHead.tsx) делает то же самое на клиенте при
  обычной SPA-навигации без перезагрузки — их тексты специально совпадают
  (общий источник — те же locales/*.json), это просто runtime-дублирование
  одного и того же под два разных момента показа.
*/

const SITE_ORIGIN = 'https://www.mangagreen.com'
const API_ORIGIN = 'https://mangared-api.onrender.com'
const DEFAULT_LANG = 'en'
const LANGS = ['ru', 'en', 'kk', 'es', 'fr', 'de', 'tr', 'ko', 'zh', 'ja'] as const
type Lang = (typeof LANGS)[number]

const LOCALES: Record<Lang, any> = { ru, en, kk, es, fr, de, tr, ko, zh, ja }

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function langFromRequest(url: URL): Lang {
  const q = url.searchParams.get('lang')
  return (LANGS as readonly string[]).includes(q ?? '') ? (q as Lang) : DEFAULT_LANG
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res.ok ? res : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface PageMeta {
  title: string
  description: string
}

/** Жанр из MangaDex-тега — переведённое имя на нужном языке, иначе английское, иначе любое. */
function localizedTagName(tag: any, lang: Lang): string {
  const names = tag?.attributes?.name ?? {}
  return names[lang] ?? names[DEFAULT_LANG] ?? Object.values(names)[0] ?? ''
}

async function resolvePageMeta(pathname: string, lang: Lang): Promise<PageMeta> {
  const t = LOCALES[lang]
  const tEn = LOCALES[DEFAULT_LANG]

  const titleTitleTemplate = t?.seo?.titlePage?.titleTemplate ?? tEn.seo.titlePage.titleTemplate
  const titleDescTemplate = t?.seo?.titlePage?.descriptionTemplate ?? tEn.seo.titlePage.descriptionTemplate
  const authorTitleTemplate = t?.seo?.authorPage?.titleTemplate ?? tEn.seo.authorPage.titleTemplate
  const authorDescTemplate = t?.seo?.authorPage?.descriptionTemplate ?? tEn.seo.authorPage.descriptionTemplate

  let match: RegExpMatchArray | null

  if (pathname === '/' || pathname === '') {
    return { title: t?.seo?.home?.title ?? tEn.seo.home.title, description: t?.seo?.home?.description ?? tEn.seo.home.description }
  }

  if (pathname === '/search') {
    return { title: t?.seo?.search?.title ?? tEn.seo.search.title, description: t?.seo?.search?.description ?? tEn.seo.search.description }
  }

  if (pathname === '/publish-guide') {
    return {
      title: t?.publishGuide?.seo?.title ?? tEn.publishGuide.seo.title,
      description: t?.publishGuide?.seo?.description ?? tEn.publishGuide.seo.description,
    }
  }

  if (pathname === '/become-author') {
    return {
      title: t?.becomeAuthor?.seo?.title ?? tEn.becomeAuthor.seo.title,
      description: t?.becomeAuthor?.seo?.description ?? tEn.becomeAuthor.seo.description,
    }
  }

  if ((match = pathname.match(/^\/title\/([^/]+)$/))) {
    const id = match[1]
    const res = await fetchWithTimeout(
      `https://api.mangadex.org/manga/${id}?includes[]=cover_art`,
      2500,
    )
    if (res) {
      const json: any = await res.json().catch(() => null)
      const titleMap = json?.data?.attributes?.title ?? {}
      const name = titleMap[lang] ?? titleMap[DEFAULT_LANG] ?? Object.values(titleMap)[0] ?? ''
      const tags = (json?.data?.attributes?.tags ?? []).filter((tag: any) => tag?.attributes?.group === 'genre')
      const genre = tags[0] ? localizedTagName(tags[0], lang) : ''
      if (name) {
        return { title: interpolate(titleTitleTemplate, { name }), description: interpolate(titleDescTemplate, { name, genre }) }
      }
    }
    return { title: t?.seo?.home?.title ?? tEn.seo.home.title, description: t?.seo?.home?.description ?? tEn.seo.home.description }
  }

  if ((match = pathname.match(/^\/originals\/([^/]+)$/))) {
    const id = match[1]
    const res = await fetchWithTimeout(`${API_ORIGIN}/api/originals/mangas/${id}`, 3000)
    if (res) {
      const json: any = await res.json().catch(() => null)
      if (json?.title) {
        return {
          title: interpolate(titleTitleTemplate, { name: json.title }),
          description: interpolate(titleDescTemplate, { name: json.title, genre: json.genres?.[0] ?? '' }),
        }
      }
    }
    return { title: t?.seo?.home?.title ?? tEn.seo.home.title, description: t?.seo?.home?.description ?? tEn.seo.home.description }
  }

  if ((match = pathname.match(/^\/author\/([^/]+)$/))) {
    const username = match[1]
    const res = await fetchWithTimeout(`${API_ORIGIN}/api/originals/authors/${username}`, 3000)
    if (res) {
      const json: any = await res.json().catch(() => null)
      if (json?.displayName) {
        return {
          title: interpolate(authorTitleTemplate, { name: json.displayName, username: json.username ?? username }),
          description: interpolate(authorDescTemplate, { name: json.displayName }),
        }
      }
    }
    return { title: t?.seo?.home?.title ?? tEn.seo.home.title, description: t?.seo?.home?.description ?? tEn.seo.home.description }
  }

  // Остальные маршруты (reader, admin, creator studio и т.д.) — SEO не
  // критичен (не целевые для поиска страницы), отдаём дефолтный тег
  // из index.html как есть, middleware их вообще не трогает (см. config.matcher ниже).
  return { title: t?.seo?.home?.title ?? tEn.seo.home.title, description: t?.seo?.home?.description ?? tEn.seo.home.description }
}

function buildHeadExtra(pathname: string, lang: Lang, meta: PageMeta): string {
  const canonicalPath = pathname === '' ? '/' : pathname
  const urlFor = (l: string) => (l === DEFAULT_LANG ? `${SITE_ORIGIN}${canonicalPath}` : `${SITE_ORIGIN}${canonicalPath}?lang=${l}`)

  const hreflangLinks = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(l)}" />`).join('\n    ')
  const xDefault = `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${canonicalPath}" />`
  const canonical = `<link rel="canonical" href="${urlFor(lang)}" />`

  return `<title>${escapeHtml(meta.title)}</title>\n    <meta name="description" content="${escapeHtml(meta.description)}" />\n    ${canonical}\n    ${hreflangLinks}\n    ${xDefault}`
}

// "matcher" — best-effort подсказка платформе, каких путей это вообще
// касается (поддержка синтаxsиса с параметрами вне Next.js не
// гарантирована). Реальная защита — isKnownSeoPath() в самом теле
// middleware ниже: она отсекает всё остальное (/assets/*, /api/*,
// /sitemap.xml, /favicon.svg, /reader, /admin и т.д.) без единого
// сетевого запроса, даже если платформа матчер не учла и дергает
// middleware вообще на каждый запрос.
export const config = {
  matcher: [
    '/',
    '/search',
    '/publish-guide',
    '/become-author',
    '/title/:id',
    '/originals/:id',
    '/author/:username',
  ],
}

function isKnownSeoPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '' || pathname === '/search' || pathname === '/publish-guide' || pathname === '/become-author') {
    return true
  }
  return /^\/title\/[^/]+$/.test(pathname) || /^\/originals\/[^/]+$/.test(pathname) || /^\/author\/[^/]+$/.test(pathname)
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.method !== 'GET') return undefined
  const url = new URL(request.url)
  if (!isKnownSeoPath(url.pathname)) return undefined
  const accept = request.headers.get('accept') ?? ''
  if (accept && !accept.includes('text/html') && !accept.includes('*/*')) return undefined

  const lang = langFromRequest(url)

  const originResponse = await fetch(new URL('/index.html', url), { headers: { accept: 'text/html' } })
  if (!originResponse.ok) return undefined
  let html = await originResponse.text()

  const meta = await resolvePageMeta(url.pathname, lang)
  const headExtra = buildHeadExtra(url.pathname, lang, meta)

  html = html.replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
  html = html.replace(/<title>[\s\S]*?<\/title>/, '')
  html = html.replace(/<meta\s+name="description"[\s\S]*?\/>/, '')
  html = html.replace(/<meta\s+name="keywords"[\s\S]*?\/>/, '')
  html = html.replace('</head>', `    ${headExtra}\n  </head>`)

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
