import { Crown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AvatarWithFrame from './AvatarWithFrame'
import { PREMIUM_FRAME_IDS, PREMIUM_ACCENT_COLORS, type PremiumFrameId } from '../constants/premium'
import styles from './PremiumPicker.module.css'

export interface PremiumSelectionValue {
  avatarFrame: string | null
  accentColor: string | null
}

interface Props {
  avatarUrl: string | null
  name: string
  current: PremiumSelectionValue
  /** Не-Premium может примерять (локальный предпросмотр), но не сохранять (см. E7). */
  isPremium: boolean
  saving: boolean
  onCustomize: (patch: Partial<PremiumSelectionValue>) => void
}

function frameLabel(t: (k: string) => string, id: PremiumFrameId) {
  return t(`premium.frames.${id}`)
}

/**
 * Раздел "Premium" в настройках профиля (см. E7): рамка аватара и
 * акцентный цвет, по отдельности, с превью на своём аватаре. Не-Premium
 * может нажимать — ничего не сохранится (см. isPremium ниже), вместо
 * этого предлагаем перейти на /premium.
 */
export default function PremiumPicker({ avatarUrl, name, current, isPremium, saving, onCustomize }: Props) {
  const { t } = useTranslation()

  return (
    <div className={styles.wrap}>
      {!isPremium && (
        <p className={styles.upsell}>
          <Crown size={14} /> {t('premium.tryOnHint')} <Link to="/premium">{t('premium.learnMore')}</Link>
        </p>
      )}

      <div className={styles.section}>
        <p className={styles.label}>{t('premium.frame')}</p>
        <div className={styles.optionRow}>
          <button
            type="button"
            className={`${styles.optionSwatch} ${!current.avatarFrame ? styles.optionSwatchActive : ''}`}
            disabled={saving}
            onClick={() => onCustomize({ avatarFrame: null })}
            title={t('premium.none') ?? ''}
          >
            <AvatarWithFrame avatarUrl={avatarUrl} name={name} size={48} frame={null} />
          </button>
          {PREMIUM_FRAME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`${styles.optionSwatch} ${current.avatarFrame === id ? styles.optionSwatchActive : ''}`}
              disabled={saving}
              onClick={() => onCustomize({ avatarFrame: id })}
              title={frameLabel(t, id) ?? ''}
            >
              <AvatarWithFrame avatarUrl={avatarUrl} name={name} size={48} frame={id} />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.label}>{t('premium.accentColor')}</p>
        <div className={styles.optionRow}>
          <button
            type="button"
            className={`${styles.colorSwatch} ${styles.colorSwatchNone} ${!current.accentColor ? styles.optionSwatchActive : ''}`}
            disabled={saving}
            onClick={() => onCustomize({ accentColor: null })}
            title={t('premium.none') ?? ''}
            aria-label={t('premium.none') ?? ''}
          />
          {PREMIUM_FRAME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`${styles.colorSwatch} ${current.accentColor === PREMIUM_ACCENT_COLORS[id] ? styles.optionSwatchActive : ''}`}
              style={{ background: PREMIUM_ACCENT_COLORS[id] }}
              disabled={saving}
              onClick={() => onCustomize({ accentColor: PREMIUM_ACCENT_COLORS[id] })}
              title={frameLabel(t, id) ?? ''}
              aria-label={frameLabel(t, id) ?? ''}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
