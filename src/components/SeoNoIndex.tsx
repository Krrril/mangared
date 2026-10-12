import { useEffect } from 'react'

/**
 * Ставит <meta name="robots" content="noindex"> на время жизни страницы —
 * для приватных экранов (настройки профиля), которые не должны попадать в
 * поиск. Своя мета-запись удаляется при уходе со страницы.
 */
export function SeoNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    meta.setAttribute('data-seo-noindex', 'true')
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])
  return null
}
