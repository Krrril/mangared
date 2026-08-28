import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { APP_LANGUAGES } from '../i18n/languages'

export const SITE_ORIGIN = 'https://mangagreen.vercel.app'
/** Язык, для которого URL не несёт ?lang= — совпадает с lng по умолчанию в src/i18n/index.ts. */
const DEFAULT_LANG = 'en'
/** Метка на всех тегах, которые ставит этот компонент — чтобы точно знать, что можно чистить/переставлять, не трогая остальной <head> (например favicon). */
const MANAGED_ATTR = 'data-seo-managed'

interface Props {
  title: string
  description: string
}

function upsertMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    el.setAttribute(MANAGED_ATTR, 'true')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function clearManagedLinks() {
  document.querySelectorAll(`link[${MANAGED_ATTR}]`).forEach((el) => el.remove())
}

function addLink(rel: string, href: string, hreflang?: string) {
  const el = document.createElement('link')
  el.setAttribute('rel', rel)
  el.setAttribute('href', href)
  if (hreflang) el.setAttribute('hreflang', hreflang)
  el.setAttribute(MANAGED_ATTR, 'true')
  document.head.appendChild(el)
}

/**
 * <title>/<meta description>/canonical/hreflang для текущей страницы —
 * без react-helmet-async: та версия молча не коммитила теги в document.head
 * в этом React 18 + Vite сетапе (похоже на нестыковку её react-версионного
 * диспетчера — не стали тратить время на дальнейшую диагностику чужой
 * библиотеки), поэтому здесь просто прямая работа с DOM через useEffect,
 * этого достаточно для той единственной задачи, что нужна на этой странице.
 *
 * Тот же title/description для настоящих краулеров (которые не выполняют
 * JS) подставляет middleware.ts на Vercel — этот компонент отвечает только
 * за то, что видно в браузере при обычной SPA-навигации без перезагрузки.
 */
export default function SeoHead({ title, description }: Props) {
  const { i18n } = useTranslation()
  const location = useLocation()
  const lang = i18n.resolvedLanguage ?? i18n.language

  useEffect(() => {
    const path = location.pathname
    const canonicalUrl = lang === DEFAULT_LANG ? `${SITE_ORIGIN}${path}` : `${SITE_ORIGIN}${path}?lang=${lang}`

    document.title = title
    document.documentElement.lang = lang
    upsertMeta('description', description)

    clearManagedLinks()
    addLink('canonical', canonicalUrl)
    for (const { code } of APP_LANGUAGES) {
      addLink('alternate', code === DEFAULT_LANG ? `${SITE_ORIGIN}${path}` : `${SITE_ORIGIN}${path}?lang=${code}`, code)
    }
    addLink('alternate', `${SITE_ORIGIN}${path}`, 'x-default')

    return () => clearManagedLinks()
  }, [title, description, lang, location.pathname])

  return null
}
