import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './CookieConsent.module.css'

const STORAGE_KEY = 'mangared:cookie-consent'

/*
  Простой баннер согласия на cookies/local storage — показывается один
  раз при первом визите (флаг в localStorage), закрывается кнопкой
  "Принять". Никакого блокирующего оверлея — сайт полностью работает
  и без нажатия, баннер просто напоминает и даёт ссылку на политику.
*/
export default function CookieConsent() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  return (
    <div className={styles.banner} role="dialog" aria-label={t('cookies.heading')}>
      <p className={styles.text}>
        {t('cookies.text')}{' '}
        <Link to="/privacy" className={styles.link}>
          {t('cookies.policyLink')}
        </Link>
      </p>
      <button
        type="button"
        className={styles.accept}
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, '1')
          setVisible(false)
        }}
      >
        {t('cookies.accept')}
      </button>
    </div>
  )
}
