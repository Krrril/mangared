import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './AvatarLightbox.module.css'

interface Props {
  src: string
  alt: string
  onClose: () => void
}

/** Полноразмерный просмотр аватара автора (клик по кругу на AuthorProfile.tsx) — тот же backdrop/panel паттерн, что и FollowListModal.tsx. */
export default function AvatarLightbox({ src, alt, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <button type="button" className={styles.close} onClick={onClose} aria-label={t('a11y.close') ?? ''}>
        <X size={22} />
      </button>
      <img src={src} alt={alt} className={styles.image} referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
