import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { Apple, Loader2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import { useAuth } from '../../services/auth/AuthContext'
import ContactsInline from '../../components/ContactsInline'
import TurnstileWidget from '../../components/TurnstileWidget'
import YandexMark from '../../components/YandexMark'
import { GOOGLE_CLIENT_ID } from '../../config/google'
import { YANDEX_CLIENT_ID } from '../../config/yandex'
import { TURNSTILE_SITE_KEY } from '../../config/turnstile'
import { API_BASE } from '../../config/api'
import { pingServer } from '../../services/auth/api'
import styles from './Auth.module.css'

type Mode = 'login' | 'register'

export default function Auth() {
  const { t } = useTranslation()
  const { login, register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  // Бесплатный план Render "усыпляет" backend — первый запрос после паузы
  // может занять до ~50 секунд (см. pingServer() ниже и DECISIONS.md).
  // Без этого флага долгий ответ выглядит как зависшая форма — пользователь
  // решает, что сайт сломан, и перезаходит (второй раз обычно быстро,
  // потому что сервер уже проснулся — отсюда жалобы "надо зайти дважды").
  const [waking, setWaking] = useState(false)
  const googleWrapRef = useRef<HTMLDivElement>(null)
  const [googleButtonWidth, setGoogleButtonWidth] = useState(300)

  // GoogleLogin принимает width только в пикселях (не "100%", см.
  // @react-oauth/google типы) — меряем обёртку сами, чтобы кнопка была
  // на всю ширину карточки и на десктопе, и на мобильном.
  useEffect(() => {
    const el = googleWrapRef.current
    if (!el) return
    const update = () => setGoogleButtonWidth(Math.round(el.clientWidth))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const locationState = location.state as { from?: string; notice?: string } | null
  const redirectTo = locationState?.from ?? '/'
  const notice = locationState?.notice

  // Ошибка от бэкенда после redirect-флоу входа через Яндекс (см.
  // server/src/routes/auth.ts, /yandex/start и /yandex/callback) —
  // приходит через query, не location.state, потому что это настоящий
  // переход с внешнего домена (oauth.yandex.ru), а не клиентская
  // навигация роутера.
  const yandexError = searchParams.get('error')

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
    setWaking(false)
    const wakingTimer = window.setTimeout(() => setWaking(true), 4000)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(name, email, password, username, turnstileToken)
      }
      goToRedirect()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.genericError'))
    } finally {
      window.clearTimeout(wakingTimer)
      setSubmitting(false)
      setWaking(false)
    }
  }

  const handleYandexLogin = () => {
    window.location.href = `${API_BASE}/auth/yandex/start`
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
          {notice && <p className={styles.notice}>{t(notice)}</p>}
          {yandexError && <p className={styles.error}>{t('auth.yandexError')}</p>}
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
              <>
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
                <label className={styles.field}>
                  <span>{t('auth.username')}</span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={24}
                    pattern="[a-zA-Z0-9_]+"
                    title={t('auth.usernameHint') ?? ''}
                    placeholder="kirill"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.trim())}
                  />
                  <span className={styles.fieldHint}>{t('auth.usernameHint')}</span>
                </label>
              </>
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

            {mode === 'register' && TURNSTILE_SITE_KEY && (
              <div className={styles.turnstileWrap}>
                <TurnstileWidget onVerify={setTurnstileToken} />
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.submit}
              disabled={submitting || (mode === 'register' && !!TURNSTILE_SITE_KEY && !turnstileToken)}
            >
              {submitting && <Loader2 size={16} className={styles.spinner} />}
              {submitting ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.register')}
            </button>
            {waking && <p className={styles.wakingHint}>{t('auth.wakingUp')}</p>}

            {mode === 'login' && (
              <Link to="/forgot-password" className={styles.forgotLink}>
                {t('auth.forgotPassword')}
              </Link>
            )}
          </form>

          <div className={styles.divider}>
            <span>{t('auth.or')}</span>
          </div>
          <div className={styles.socialButtons}>
            {GOOGLE_CLIENT_ID && (
              <div className={styles.googleButtonWrap} ref={googleWrapRef}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError(t('auth.genericError'))}
                  theme="filled_black"
                  shape="pill"
                  width={googleButtonWidth}
                />
              </div>
            )}
            {YANDEX_CLIENT_ID && (
              <button type="button" className={styles.yandexButton} onClick={handleYandexLogin}>
                <YandexMark size={18} />
                {t('auth.continueWithYandex')}
              </button>
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
