/*
  Динамический sitemap.xml — Vercel Edge Function, живёт в /api/sitemap и
  доступен как /sitemap.xml через rewrite в vercel.json (см. этот файл).
  Индексируем только наш собственный контент (Originals-тайтлы и профили
  авторов) — MangaDex-каталог сюда не входит, это чужой контент, см. задачу.
*/

export const config = { runtime: 'edge' }

const SITE_ORIGIN = 'https://www.mangagreen.com'
const API_ORIGIN = 'https://mangared-api.onrender.com'
const LANGS = ['ru', 'en', 'kk', 'es', 'fr', 'de', 'tr', 'ko', 'zh', 'ja']
const DEFAULT_LANG = 'en'

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function urlEntry(path: string, lastmod?: string): string {
  const urlFor = (l: string) => (l === DEFAULT_LANG ? `${SITE_ORIGIN}${path}` : `${SITE_ORIGIN}${path}?lang=${l}`)
  const alternates = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(urlFor(l))}"/>`).join('\n')
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${SITE_ORIGIN}${path}`)}"/>`
  return `  <url>\n    <loc>${escapeXml(urlFor(DEFAULT_LANG))}</loc>\n${alternates}\n${xDefault}${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`
}

interface OriginalManga {
  id: string
  author: { username: string }
}

export default async function handler(): Promise<Response> {
  const today = new Date().toISOString().slice(0, 10)

  const staticPaths = ['/', '/search', '/originals', '/publish-guide', '/become-author', '/terms', '/privacy', '/publishing-rules']

  let mangas: OriginalManga[] = []
  try {
    const res = await fetch(`${API_ORIGIN}/api/originals/mangas?sort=new`, { signal: AbortSignal.timeout(8000) })
    if (res.ok) mangas = await res.json()
  } catch {
    // Бэкенд на Render "спит" после простоя — если не успел проснуться за
    // таймаут, отдаём sitemap хотя бы со статичными страницами, а не 500.
  }

  const authorUsernames = [...new Set(mangas.map((m) => m.author?.username).filter(Boolean))]

  const entries = [
    ...staticPaths.map((p) => urlEntry(p, today)),
    ...mangas.map((m) => urlEntry(`/originals/${m.id}`)),
    ...authorUsernames.map((u) => urlEntry(`/author/${u}`)),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
