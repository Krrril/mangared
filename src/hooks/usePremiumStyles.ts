import { useEffect } from 'react'
import { PREMIUM_ANIMATIONS_CSS } from '../constants/premium'

const STYLE_ID = 'pg-premium-animations'

/** Вставляет общий <style> с анимациями рамок/фонов/стикеров в <head> один раз, сколько бы аватаров/фонов ни было на странице. */
export function usePremiumStyles(): void {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = PREMIUM_ANIMATIONS_CSS
    document.head.appendChild(style)
  }, [])
}
