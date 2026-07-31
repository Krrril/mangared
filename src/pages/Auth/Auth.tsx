import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { Apple, Loader2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../services/auth/AuthContext'
import ContactsInline from '../../components/ContactsInline'
import { GOOGLE_CLIENT_ID } from '../../config/google'
import { pingServer } from '../../services/auth/api'
import styles from './Auth.module.css'

type Mode = 'login' | 'register'

export default function Auth() {
  const { t } = useTranslation()
  const { login, register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'

  // Будим backend заранее, пока пользователь ещё заполняет форму —
  // см. комментарий у pingServer().
  useEffect(() => {
    pingServer()
  }, [])

  const goToRedirect = () => navigate(redirectTo, { replace: true })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(name, email, password)
      }
      goToRedirect()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return
    setError(null)
    try {
      await loginWithGoogle(credentialResponse.credential)
      goToRedirect()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.genericError'))
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
            {mode === 'register' && (
              <label className={styles.field}>
                <span>{t('auth.name')}</span>
                <input
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
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
              {submitting && <Loader2 size={16} className={styles.spinner} />}
              {submitting ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.register')}
            </button>
          </form>

          <div className={styles.divider}>
            <span>{t('auth.or')}</span>
          </div>
          <div className={styles.socialButtons}>
            {GOOGLE_CLIENT_ID && (
              <div className={styles.googleButtonWrap}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError(t('auth.genericError'))}
                  theme="filled_black"
                  shape="pill"
                  width="100%"
                />
              </div>
            )}
            <button type="button" className={styles.appleButton} disabled title={t('auth.appleSoonHint')}>
              <Apple size={18} />
              {t('auth.continueWithApple')}
              <span className={styles.soonTag}>{t('auth.soon')}</span>
            </button>
          </div>

          <p className={styles.help}>{t('auth.contactHelp')}</p>
          <ContactsInline />
        </div>
      </div>
    </MainLayout>
  )
}
