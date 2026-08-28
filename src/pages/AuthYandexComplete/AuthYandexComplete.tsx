import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../services/auth/AuthContext'
import styles from '../Auth/Auth.module.css'

/**
 * Промежуточная страница, на которую бэкенд редиректит после успешного
 * OAuth-обмена с Яндексом (см. server/src/routes/auth.ts, /yandex/callback)
 * — токен приходит в query (?token=...), здесь он просто сохраняется через
 * AuthContext и пользователь уходит на главную. Сама страница почти не
 * видна — доля секунды между редиректом и переходом на "/".
 */
export default function AuthYandexComplete() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { completeYandexLogin } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const token = searchParams.get('token')
    if (!token) {
      setError(t('auth.genericError'))
      return
    }
    completeYandexLogin(token)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError(t('auth.genericError')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <div className={styles.card}>
          {error ? (
            <p className={styles.error}>{error}</p>
          ) : (
            <p className={styles.help}>
              <Loader2 size={16} className={styles.spinner} /> {t('common.loading')}
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
