import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import StickerIcon from './StickerIcon'
import { PREMIUM_STICKERS, type PremiumSticker } from '../constants/premium'
import styles from './CommentStickers.module.css'

interface Props {
  reactions: Partial<Record<PremiumSticker, number>>
  myReactions: PremiumSticker[]
  /** Есть токен и профиль загружен — иначе весь блок скрыт выше по дереву. */
  isPremium: boolean
  onToggle: (type: PremiumSticker) => void
}

/**
 * Стикеры-реакции под комментарием (см. E5). Ставить может только
 * Premium — не-Premium видит те же стикеры и счётчики (реакции публичны),
 * но клик по любому из них показывает подсказку про Premium вместо запроса.
 */
export default function CommentStickers({ reactions, myReactions, isPremium, onToggle }: Props) {
  const { t } = useTranslation()
  const [showUpsell, setShowUpsell] = useState(false)

  const used = PREMIUM_STICKERS.filter((s) => (reactions[s] ?? 0) > 0)
  const unused = PREMIUM_STICKERS.filter((s) => !(reactions[s] ?? 0))

  function handleClick(type: PremiumSticker) {
    if (!isPremium) {
      setShowUpsell(true)
      return
    }
    onToggle(type)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {used.map((type) => (
          <button
            key={type}
            type="button"
            className={`${styles.pill} ${myReactions.includes(type) ? styles.pillActive : ''}`}
            onClick={() => handleClick(type)}
            title={t(`premium.stickers.${type}`) ?? ''}
          >
            <StickerIcon type={type} size={16} />
            <span>{reactions[type]}</span>
          </button>
        ))}
        <details className={styles.picker}>
          <summary className={styles.pickerTrigger} title={t('premium.addSticker') ?? ''}>
            +
          </summary>
          <div className={styles.pickerGrid}>
            {unused.map((type) => (
              <button key={type} type="button" className={styles.pickerItem} onClick={() => handleClick(type)} title={t(`premium.stickers.${type}`) ?? ''}>
                <StickerIcon type={type} size={20} />
              </button>
            ))}
          </div>
        </details>
      </div>
      {showUpsell && (
        <p className={styles.upsell}>
          {t('premium.stickersUpsell')} <Link to="/premium">{t('premium.learnMore')}</Link>
        </p>
      )}
    </div>
  )
}
