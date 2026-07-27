import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../services/auth/AuthContext'
import ContactsInline from '../../components/ContactsInline'
import styles from './Auth.module.css'

type Mode = 'login' | 'register'

export default function Auth() {
  const { t } = useTranslation()
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      navigate(redirectTo, { replace: true })
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
          <div className={styles.tabs}>
            <button
              type="button"
              className={mode === 'login' ? styles.tabActive : styles.tab}
              onClick={() => setMode('login')}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              className={mode === 'register' ? styles.tabActive : styles.tab}
              onClick={() => setMode('register')}
            >
              {t('auth.register')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
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
            <label className={styles.field}>
              <span>{t('auth.password')}</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.register')}
            </button>
          </form>

          <p className={styles.help}>{t('auth.contactHelp')}</p>
          <ContactsInline />
        </div>
      </div>
    </MainLayout>
  )
}
