import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AvatarWithFrame from './AvatarWithFrame'
import { PREMIUM_BUNDLE_IDS, PREMIUM_ACCENT_COLORS, BACKGROUND_REGISTRY, BACKGROUND_GRADIENTS, type PremiumBundleId } from '../constants/premium'
import styles from './PremiumPicker.module.css'

export interface PremiumSelectionValue {
  avatarFrame: string | null
  profileBackground: string | null
  accentColor: string | null
  themeBundle: string | null
}

interface Props {
  avatarUrl: string | null
  name: string
  current: PremiumSelectionValue
  /** Не-Premium может примерять (локальный предпросмотр), но не сохранять (см. E7). */
  isPremium: boolean
  saving: boolean
  onApplyBundle: (bundle: PremiumBundleId) => void
  onCustomize: (patch: Partial<Pick<PremiumSelectionValue, 'avatarFrame' | 'profileBackground' | 'accentColor'>>) => void
}

function bundleLabel(t: (k: string) => string, id: PremiumBundleId) {
  return t(`premium.bundles.${id}`)
}

/** Мини-превью фона связки — маленький статичный SVG, без анимации (см. constants/premium.tsx). */
function BackgroundSwatch({ id }: { id: PremiumBundleId }) {
  const Art = BACKGROUND_REGISTRY[id]
  const gradient = BACKGROUND_GRADIENTS[id]
  return (
    <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" className={styles.swatch} aria-hidden="true">
      <defs>
        <linearGradient id={`${gradient.id}-sw`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={gradient.stops[0]} />
          <stop offset="1" stopColor={gradient.stops[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="140" fill={`url(#${gradient.id}-sw)`} />
      {Art({ animated: false })}
    </svg>
  )
}

/**
 * Раздел "Premium" в настройках профиля (см. E7) — "Готовые связки" (превью
 * целиком, применяются одним нажатием) и "Своя сборка" (рамка/фон/цвет по
 * отдельности). Не-Premium может нажимать — просто ничего не сохранится
 * (см. isPremium ниже), вместо этого предлагаем перейти на /premium.
 */
export default function PremiumPicker({ avatarUrl, name, current, isPremium, saving, onApplyBundle, onCustomize }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'bundles' | 'custom'>('bundles')

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        <button type="button" className={tab === 'bundles' ? styles.tabActive : styles.tab} onClick={() => setTab('bundles')}>
          {t('premium.readyBundles')}
        </button>
        <button type="button" className={tab === 'custom' ? styles.tabActive : styles.tab} onClick={() => setTab('custom')}>
          {t('premium.customBuild')}
        </button>
      </div>

      {!isPremium && (
        <p className={styles.upsell}>
          <Crown size={14} /> {t('premium.tryOnHint')} <Link to="/premium">{t('premium.learnMore')}</Link>
        </p>
      )}

      {tab === 'bundles' ? (
        <div className={styles.bundleGrid}>
          {PREMIUM_BUNDLE_IDS.map((id) => {
            const active = current.themeBundle === id
            return (
              <button key={id} type="button" className={`${styles.bundleCard} ${active ? styles.bundleCardActive : ''}`} disabled={saving} onClick={() => onApplyBundle(id)}>
                <span className={styles.bundlePreview}>
                  <BackgroundSwatch id={id} />
                  <span className={styles.bundleAvatarWrap}>
                    <AvatarWithFrame avatarUrl={avatarUrl} name={name} size={56} frame={id} />
                  </span>
                  {active && (
                    <span className={styles.bundleCheck}>
                      <Check size={12} />
                    </span>
                  )}
                </span>
                <span className={styles.bundleName} style={{ color: PREMIUM_ACCENT_COLORS[id] }}>
                  {bundleLabel(t, id)}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className={styles.customGrid}>
          <div>
            <p className={styles.customLabel}>{t('premium.frame')}</p>
            <div className={styles.optionRow}>
              <button
                type="button"
                className={`${styles.optionSwatch} ${!current.avatarFrame ? styles.optionSwatchActive : ''}`}
                disabled={saving}
                onClick={() => onCustomize({ avatarFrame: null })}
                title={t('premium.none') ?? ''}
              >
                <AvatarWithFrame avatarUrl={avatarUrl} name={name} size={44} frame={null} />
              </button>
              {PREMIUM_BUNDLE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.optionSwatch} ${current.avatarFrame === id ? styles.optionSwatchActive : ''}`}
                  disabled={saving}
                  onClick={() => onCustomize({ avatarFrame: id })}
                  title={bundleLabel(t, id) ?? ''}
                >
                  <AvatarWithFrame avatarUrl={avatarUrl} name={name} size={44} frame={id} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={styles.customLabel}>{t('premium.background')}</p>
            <div className={styles.optionRow}>
              <button
                type="button"
                className={`${styles.bgSwatchButton} ${!current.profileBackground ? styles.optionSwatchActive : ''}`}
                disabled={saving}
                onClick={() => onCustomize({ profileBackground: null })}
                title={t('premium.none') ?? ''}
              />
              {PREMIUM_BUNDLE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.bgSwatchButton} ${current.profileBackground === id ? styles.optionSwatchActive : ''}`}
                  disabled={saving}
                  onClick={() => onCustomize({ profileBackground: id })}
                  title={bundleLabel(t, id) ?? ''}
                >
                  <BackgroundSwatch id={id} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={styles.customLabel}>{t('premium.accentColor')}</p>
            <div className={styles.optionRow}>
              {PREMIUM_BUNDLE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.colorSwatch} ${current.accentColor === PREMIUM_ACCENT_COLORS[id] ? styles.optionSwatchActive : ''}`}
                  style={{ background: PREMIUM_ACCENT_COLORS[id] }}
                  disabled={saving}
                  onClick={() => onCustomize({ accentColor: PREMIUM_ACCENT_COLORS[id] })}
                  title={bundleLabel(t, id) ?? ''}
                  aria-label={bundleLabel(t, id) ?? ''}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
