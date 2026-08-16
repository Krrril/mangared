import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { forgotPasswordRequest } from '../../services/auth/api'
import styles from '../Auth/Auth.module.css'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPasswordRequest(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MainLayout>
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.pageTitle}>{t('forgotPassword.title')}</h1>

          {sent ? (
            <p className={styles.notice}>{t('forgotPassword.sent')}</p>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <p className={styles.help} style={{ margin: 0 }}>
                {t('forgotPassword.description')}
              </p>
              <label className={styles.field}>
                <span>{t('auth.email')}</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting && <Loader2 size={16} className={styles.spinner} />}
                {submitting ? t('common.loading') : t('forgotPassword.submit')}
              </button>
            </form>
          )}

          <p className={styles.help}>
            <Link to="/auth" className={styles.forgotLink}>
              {t('forgotPassword.backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </MainLayout>
  )
}
