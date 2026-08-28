import { GA_MEASUREMENT_ID, YANDEX_METRIKA_ID } from '../../config/analytics'

/*
  GA4 (gtag.js) и Яндекс.Метрика — оба подключаются лениво, при первом
  же НЕ исключённом просмотре страницы (см. EXCLUDED_PREFIXES ниже), а не
  сразу при старте приложения:
    - если посетитель вообще ни разу не попадёт на исключённую страницу,
      разницы нет — подключение происходит на первом же рендере, как
      обычно ожидалось бы;
    - но если кто-то (по факту — только сам владелец/админ) откроет сайт
      СРАЗУ на /admin, скрипты вообще не начнут грузиться, пока не
      перейдут на обычную страницу — то есть "не подключать аналитику
      на служебных страницах" выполняется буквально, включая сетевые
      запросы к google-analytics.com/mc.yandex.ru, а не только событие
      просмотра.
  Оба скрипта сами по себе асинхронные (async на <script>), рендер
  страницы не блокируют независимо от того, когда именно вызвана загрузка.
*/

// Только /admin — явно названная "служебная" страница в задаче. /creator
// и /auth сознательно НЕ исключены: это часть обычного пользовательского
// пути (воронка "дошёл до регистрации", "дошёл до студии автора"),
// отслеживать их — то, ради чего аналитику вообще подключают.
const EXCLUDED_PREFIXES = ['/admin']

function isExcluded(path: string): boolean {
  return EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    ym?: (...args: unknown[]) => void
  }
}

let gaInitialized = false
let yandexScriptLoaded = false
let yandexInitialized = false

function initGa(measurementId: string) {
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args)
  }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)

  window.gtag('js', new Date())
  // send_page_view: false — сами шлём page_view на каждый переход (см.
  // trackPageView ниже), в том числе на самый первый, иначе SPA-переходы
  // без полной перезагрузки страницы не считались бы вовсе.
  window.gtag('config', measurementId, { send_page_view: false })
}

/** Только сам загрузчик — счётчик инициализируется отдельным вызовом ym(id, 'init', ...) в trackPageView, при первом НЕ исключённом переходе (см. комментарий выше). */
function loadYandexScript() {
  ;(function (m: any, e: Document, t: string, r: string, i: string) {
    m[i] =
      m[i] ||
      function (...args: unknown[]) {
        ;(m[i].a = m[i].a || []).push(args)
      }
    m[i].l = Date.now()
    for (let j = 0; j < e.scripts.length; j++) {
      if (e.scripts[j].src === r) return
    }
    const k = e.createElement(t) as HTMLScriptElement
    const a = e.getElementsByTagName(t)[0]
    k.async = true
    k.src = r
    a.parentNode!.insertBefore(k, a)
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym')
}

/** Вызывается при каждом переходе между страницами (см. components/AnalyticsTracker.tsx) — при первом непустом просмотре заодно лениво подключает скрипты (см. комментарий в начале файла). */
export function trackPageView(path: string): void {
  if (isExcluded(path)) return

  if (GA_MEASUREMENT_ID) {
    if (!gaInitialized) {
      initGa(GA_MEASUREMENT_ID)
      gaInitialized = true
    }
    window.gtag?.('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    })
  }

  if (YANDEX_METRIKA_ID) {
    if (!yandexScriptLoaded) {
      loadYandexScript()
      yandexScriptLoaded = true
    }
    if (!yandexInitialized) {
      // init() сам считает первый просмотр текущей страницы — второй,
      // ручной hit() для той же страницы сразу следом задвоил бы счётчик,
      // поэтому на самый первый непустой переход только init, без hit.
      window.ym?.(Number(YANDEX_METRIKA_ID), 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: 'dataLayer',
        referrer: document.referrer,
        url: window.location.href,
        accurateTrackBounce: true,
        trackLinks: true,
      })
      yandexInitialized = true
    } else {
      window.ym?.(Number(YANDEX_METRIKA_ID), 'hit', path, {
        referrer: document.referrer,
        title: document.title,
      })
    }
  }
}
