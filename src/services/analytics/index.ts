import { GA_MEASUREMENT_ID, YANDEX_METRIKA_ID } from '../../config/analytics'
import { API_BASE } from '../../config/api'
import { getStoredToken } from '../auth/token'

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

// Источник визита (referrer-домен и utm_*) считаем из адреса и document.
// referrer при первом просмотре и шлём вместе с запросами, пока сервер
// не подтвердил хотя бы один из них (см. sourceDelivered ниже). Почему не
// "на каждый переход": document.referrer в SPA не меняется при внутренних
// переходах, а utm-параметры пропадают из URL при первом же клике по
// ссылке сайта — позже источник уже не восстановить, а повторять его на
// каждом переходе значило бы приписывать новому визиту (кука истекла,
// вкладка осталась открытой) чужой источник. Почему не "строго один
// раз": два запроса могут уйти до первого ответа (двойной эффект
// StrictMode в dev, быстрый переход) — тогда на сервере, где кука ещё не
// поставлена, оба создают запись визита, и вторая осталась бы без
// источника. Ничего не пишем в cookie/localStorage — только в памяти страницы.
interface VisitSource {
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

let landingSource: VisitSource | null = null
let sourceDelivered = false

function referrerDomain(): string | undefined {
  try {
    if (!document.referrer) return undefined
    const host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, '')
    // Свой же сайт (переход внутри, возврат с OAuth и т.п.) источником не считаем.
    if (!host || host === window.location.hostname.replace(/^www\./, '')) return undefined
    return host
  } catch {
    return undefined
  }
}

function visitSource(): VisitSource {
  if (sourceDelivered) return {}
  if (!landingSource) {
    const params = new URLSearchParams(window.location.search)
    const pick = (key: string) => params.get(key)?.trim().slice(0, 100) || undefined
    landingSource = {
      referrer: referrerDomain(),
      utmSource: pick('utm_source'),
      utmMedium: pick('utm_medium'),
      utmCampaign: pick('utm_campaign'),
    }
  }
  return landingSource
}

/**
 * Лёгкая собственная аналитика в /admin (см. VisitLog в schema.prisma) —
 * тот же хук, что и GA4/Метрика ниже (тот же путь, то же исключение
 * /admin), но отдельный fire-and-forget запрос к своему бэкенду, а не
 * замена стороннего. keepalive — чтобы запрос пережил переход на другую
 * страницу (SPA-навигация может размонтировать компонент раньше, чем
 * успеет уйти обычный fetch, см. MDN про keepalive/sendBeacon).
 */
function trackOwnVisit(path: string) {
  // Токен (если пользователь залогинен) нужен только чтобы сервер не
  // считал визиты админа на любом устройстве — анонимному посетителю он
  // не требуется, запрос идёт и без него.
  const token = getStoredToken()
  fetch(`${API_BASE}/stats/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ path, ...visitSource() }),
    keepalive: true,
    // Без этого браузер не отправит/не примет visit_id и is_owner (см.
    // server/src/utils/visitCookies.ts) — фронтенд и API на разных origin
    // (mangagreen.com и onrender.com), кросс-доменные куки без явного
    // credentials браузер по умолчанию не пришлёт.
    credentials: 'include',
  })
    .then((res) => {
      if (res.ok) sourceDelivered = true
    })
    .catch(() => {})
}

/** Вызывается при каждом переходе между страницами (см. components/AnalyticsTracker.tsx) — при первом непустом просмотре заодно лениво подключает скрипты (см. комментарий в начале файла). */
export function trackPageView(path: string): void {
  if (isExcluded(path)) return

  trackOwnVisit(path)

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

/**
 * Произвольное событие (не просмотр страницы) — например, клик по CTA.
 * Шлём только в уже подключённые счётчики (см. trackPageView выше): если
 * ни один ID не задан в конфиге, скрипты ещё не загружены и вызов просто
 * ничего не делает, а не роняет страницу.
 */
export function trackEvent(name: string, params: Record<string, string> = {}): void {
  window.gtag?.('event', name, params)
  if (YANDEX_METRIKA_ID) {
    window.ym?.(Number(YANDEX_METRIKA_ID), 'reachGoal', name, params)
  }
}
