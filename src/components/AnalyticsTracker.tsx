import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../services/analytics'

/**
 * Ничего не рендерит — только следит за сменой маршрута (useLocation) и
 * шлёт просмотр страницы в GA4/Яндекс.Метрику на каждый переход, включая
 * первый (react-router меняет только children внутри <Routes>, полной
 * перезагрузки при переходе между тайтлами/профилями/страницами нет —
 * без этого компонента аналитика видела бы только самый первый вход на сайт).
 */
export default function AnalyticsTracker() {
  const location = useLocation()

  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])

  return null
}
