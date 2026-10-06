import { STICKER_ICON, type PremiumSticker } from '../constants/premium'
import { usePremiumStyles } from '../hooks/usePremiumStyles'

interface Props {
  type: PremiumSticker
  size?: number
}

/** Один стикер-реакция (см. E5) — простая плоская SVG-анимация одним стилем. */
export default function StickerIcon({ type, size = 20 }: Props) {
  usePremiumStyles()
  return <>{STICKER_ICON[type]({ size })}</>
}
