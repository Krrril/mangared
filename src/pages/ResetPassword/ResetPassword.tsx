import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { resetPasswordRequest } from '../../services/auth/api'
import styles from '../Auth/Auth.module.css'

export default function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await resetPasswordRequest(token, password)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetPassword.invalidToken'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <MainLayout>
        <div className={styles.wrap}>
          <div className={styles.card}>
            <p className={styles.error}>{t('resetPassword.invalidToken')}</p>
            <p className={styles.help}>
              <Link to="/forgot-password" className={styles.forgotLink}>
                {t('forgotPassword.title')}
              </Link>
            </p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.pageTitle}>{t('resetPassword.title')}</h1>

          {success ? (
            <>
              <p className={styles.notice}>{t('resetPassword.success')}</p>
              <button type="button" className={styles.submit} onClick={() => navigate('/auth')}>
                {t('resetPassword.goToLogin')}
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <label className={styles.field}>
                <span>{t('resetPassword.newPassword')}</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting && <Loader2 size={16} className={styles.spinner} />}
                {submitting ? t('common.loading') : t('resetPassword.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
