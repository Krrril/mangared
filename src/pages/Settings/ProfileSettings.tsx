import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, X } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import RequireAuth from '../../components/RequireAuth'
import { useAuth } from '../../services/auth/AuthContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { SeoNoIndex } from '../../components/SeoNoIndex'
import {
  ProfileApiError,
  changeName,
  changeUsername,
  checkUsernameAvailable,
  fetchIdentity,
} from '../../services/profile/api'
import type { IdentityState } from '../../services/profile/api'
import styles from './ProfileSettings.module.css'

type Availability = 'idle' | 'checking' | 'available' | 'same' | 'invalid' | 'unavailable' | 'error'

const USERNAME_FORMAT = /^[a-z0-9_]+$/

function ProfileSettingsForm() {
  const { t, i18n } = useTranslation()
  const { token, refreshUser } = useAuth()

  const [identity, setIdentity] = useState<IdentityState | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [usernameInput, setUsernameInput] = useState('')
  const [availability, setAvailability] = useState<Availability>('idle')
  const [confirming, setConfirming] = useState(false)
  const [usernameBusy, setUsernameBusy] = useState(false)
  const [usernameMessage, setUsernameMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const [nameInput, setNameInput] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameMessage, setNameMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchIdentity(token)
      .then((state) => {
        if (cancelled) return
        setIdentity(state)
        setNameInput(state.name)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const limits = identity?.limits
  const usernameMin = limits?.usernameMin ?? 3
  const usernameMax = limits?.usernameMax ?? 20
  const nameMin = limits?.nameMin ?? 2
  const nameMax = limits?.nameMax ?? 30

  const formatDate = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })
      : ''

  function errorText(err: unknown): string {
    if (err instanceof ProfileApiError) {
      switch (err.code) {
        case 'invalid_username':
          return t('settings.errors.invalid_username', { min: usernameMin, max: usernameMax })
        case 'username_unavailable':
          return t('settings.errors.username_unavailable')
        case 'invalid_name':
          return t('settings.errors.invalid_name', { min: nameMin, max: nameMax })
        case 'name_unavailable':
          return t('settings.errors.name_unavailable')
        case 'cooldown':
          return t('settings.errors.cooldown', { date: formatDate(err.nextChangeAt) })
        case 'rate_limited':
          return t('settings.errors.rate_limited')
        default:
          break
      }
    }
    return t('settings.errors.generic')
  }

  // --- живая проверка ника: дебаунс 400 мс, устаревшие ответы отбрасываем ---
  const normalizedInput = usernameInput.trim().replace(/^@/, '').toLowerCase()
  const debouncedInput = useDebouncedValue(normalizedInput, 400)
  const requestSeq = useRef(0)

  const currentUsername = identity?.username?.toLowerCase() ?? null
  const localProblem = useMemo<Availability | null>(() => {
    if (!normalizedInput) return 'idle'
    if (normalizedInput === currentUsername) return 'same'
    if (normalizedInput.length < usernameMin || normalizedInput.length > usernameMax || !USERNAME_FORMAT.test(normalizedInput)) {
      return 'invalid'
    }
    return null
  }, [normalizedInput, currentUsername, usernameMin, usernameMax])

  useEffect(() => {
    if (!token || localProblem !== null || debouncedInput !== normalizedInput) return
    const seq = ++requestSeq.current
    const controller = new AbortController()
    setAvailability('checking')
    checkUsernameAvailable(token, debouncedInput, controller.signal)
      .then((res) => {
        if (seq !== requestSeq.current) return
        if (res.available) setAvailability(res.reason === 'same' ? 'same' : 'available')
        else setAvailability(res.reason === 'invalid' ? 'invalid' : 'unavailable')
      })
      .catch((err) => {
        if (seq !== requestSeq.current || (err instanceof DOMException && err.name === 'AbortError')) return
        setAvailability('error')
      })
    return () => controller.abort()
  }, [token, debouncedInput, normalizedInput, localProblem])

  const shownAvailability: Availability = localProblem ?? (debouncedInput !== normalizedInput ? 'checking' : availability)
  const canSubmitUsername =
    !!identity?.canChangeUsername && shownAvailability === 'available' && localProblem === null && !usernameBusy

  async function submitUsername() {
    if (!token || !canSubmitUsername) return
    setUsernameBusy(true)
    setUsernameMessage(null)
    try {
      const next = await changeUsername(token, normalizedInput)
      setIdentity(next)
      setUsernameInput('')
      setAvailability('idle')
      setConfirming(false)
      setUsernameMessage({ kind: 'ok', text: t('settings.nickname.saved', { username: next.username }) })
      refreshUser().catch(() => {})
    } catch (err) {
      setConfirming(false)
      setUsernameMessage({ kind: 'error', text: errorText(err) })
      // Возможно, кто-то занял ник между проверкой и сохранением.
      setAvailability('idle')
      fetchIdentity(token).then(setIdentity).catch(() => {})
    } finally {
      setUsernameBusy(false)
    }
  }

  async function submitName(e: FormEvent) {
    e.preventDefault()
    if (!token || !identity?.canChangeName || nameBusy) return
    setNameBusy(true)
    setNameMessage(null)
    try {
      const next = await changeName(token, nameInput)
      setIdentity(next)
      setNameInput(next.name)
      setNameMessage({ kind: 'ok', text: t('settings.name.saved') })
      refreshUser().catch(() => {})
    } catch (err) {
      setNameMessage({ kind: 'error', text: errorText(err) })
    } finally {
      setNameBusy(false)
    }
  }

  const nameTrimmed = nameInput.replace(/\s+/g, ' ').trim()
  const nameLength = [...nameTrimmed].length
  const nameChanged = !!identity && nameTrimmed !== identity.name
  const nameValid = nameLength >= nameMin && nameLength <= nameMax
  const canSubmitName = !!identity?.canChangeName && nameChanged && nameValid && !nameBusy

  function statusLine() {
    switch (shownAvailability) {
      case 'checking':
        return (
          <span className={styles.statusNeutral}>
            <Loader2 size={14} className={styles.spin} aria-hidden="true" /> {t('settings.nickname.checking')}
          </span>
        )
      case 'available':
        return (
          <span className={styles.statusOk}>
            <Check size={14} aria-hidden="true" /> {t('settings.nickname.available')}
          </span>
        )
      case 'same':
        return <span className={styles.statusNeutral}>{t('settings.nickname.same')}</span>
      case 'invalid':
        return (
          <span className={styles.statusError}>
            <X size={14} aria-hidden="true" /> {t('settings.nickname.invalid', { min: usernameMin, max: usernameMax })}
          </span>
        )
      case 'unavailable':
        return (
          <span className={styles.statusError}>
            <X size={14} aria-hidden="true" /> {t('settings.nickname.unavailable')}
          </span>
        )
      case 'error':
        return <span className={styles.statusError}>{t('settings.errors.generic')}</span>
      default:
        return null
    }
  }

  return (
    <MainLayout>
      <SeoNoIndex />
      <div className={styles.page}>
        <h1 className={styles.title}>{t('settings.title')}</h1>
        <p className={styles.lead}>{t('settings.lead')}</p>

        {loadError && <p className={styles.statusError}>{t('settings.errors.generic')}</p>}
        {!identity && !loadError && <p className={styles.statusNeutral}>{t('common.loading')}</p>}

        {identity && (
          <>
            <section className={styles.card} aria-labelledby="nick-title">
              <h2 id="nick-title" className={styles.cardTitle}>
                {t('settings.nickname.title')}
              </h2>
              <p className={styles.about}>
                {t('settings.nickname.about', { username: identity.username ?? 'username' })}
              </p>
              <p className={styles.current}>
                {identity.username ? t('settings.nickname.current', { username: identity.username }) : t('settings.nickname.none')}
                {identity.username && (
                  <>
                    {' · '}
                    <Link to={`/author/${identity.username}`}>{t('settings.nickname.openProfile')}</Link>
                  </>
                )}
              </p>

              <label className={styles.label} htmlFor="nick-input">
                {t('settings.nickname.label')}
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.prefix} aria-hidden="true">
                  @
                </span>
                <input
                  id="nick-input"
                  className={styles.input}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={usernameMax + 1}
                  value={usernameInput}
                  disabled={!identity.canChangeUsername}
                  placeholder={identity.username ?? ''}
                  aria-describedby="nick-status nick-hint"
                  aria-invalid={shownAvailability === 'invalid' || shownAvailability === 'unavailable'}
                  onChange={(e) => {
                    setUsernameInput(e.target.value)
                    setUsernameMessage(null)
                  }}
                />
              </div>
              <div id="nick-status" className={styles.status} aria-live="polite">
                {statusLine()}
              </div>
              <p id="nick-hint" className={styles.hint}>
                {t('settings.nickname.rules', { min: usernameMin, max: usernameMax })}{' '}
                {identity.canChangeUsername
                  ? identity.usernameAutoAssigned
                    ? t('settings.nickname.firstFree', { days: limits?.usernameCooldownDays ?? 30 })
                    : t('settings.nickname.cooldownRule', { days: limits?.usernameCooldownDays ?? 30 })
                  : t('settings.nickname.locked', {
                      days: limits?.usernameCooldownDays ?? 30,
                      date: formatDate(identity.usernameNextChangeAt),
                    })}
              </p>

              {usernameMessage && (
                <p className={usernameMessage.kind === 'ok' ? styles.statusOk : styles.statusError} role="status">
                  {usernameMessage.text}
                </p>
              )}

              <button type="button" className={styles.primaryButton} disabled={!canSubmitUsername} onClick={() => setConfirming(true)}>
                {t('settings.nickname.save')}
              </button>
            </section>

            <section className={styles.card} aria-labelledby="name-title">
              <h2 id="name-title" className={styles.cardTitle}>
                {t('settings.name.title')}
              </h2>
              <p className={styles.about}>{t('settings.name.about')}</p>
              <form onSubmit={submitName}>
                <label className={styles.label} htmlFor="name-input">
                  {t('settings.name.label')}
                </label>
                <input
                  id="name-input"
                  className={`${styles.input} ${styles.inputPlain}`}
                  type="text"
                  autoComplete="name"
                  maxLength={nameMax + 10}
                  value={nameInput}
                  disabled={!identity.canChangeName}
                  aria-describedby="name-hint"
                  onChange={(e) => {
                    setNameInput(e.target.value)
                    setNameMessage(null)
                  }}
                />
                <p id="name-hint" className={styles.hint}>
                  {t('settings.name.rules', { min: nameMin, max: nameMax, days: limits?.nameCooldownDays ?? 7 })}{' '}
                  {!identity.canChangeName && t('settings.name.nextChange', { date: formatDate(identity.nameNextChangeAt) })}
                </p>
                {nameMessage && (
                  <p className={nameMessage.kind === 'ok' ? styles.statusOk : styles.statusError} role="status">
                    {nameMessage.text}
                  </p>
                )}
                <button type="submit" className={styles.primaryButton} disabled={!canSubmitName}>
                  {t('settings.name.save')}
                </button>
              </form>
            </section>
          </>
        )}
      </div>

      {confirming && identity && (
        <div className={styles.backdrop} role="presentation" onClick={() => !usernameBusy && setConfirming(false)}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className={styles.dialogTitle}>
              {t('settings.confirm.title', { username: normalizedInput })}
            </h2>
            <ul className={styles.dialogList}>
              <li>{t('settings.confirm.newAddress', { username: normalizedInput })}</li>
              {identity.username && <li>{t('settings.confirm.oldLinks', { old: identity.username })}</li>}
              <li>
                {t('settings.confirm.limits', {
                  days: limits?.usernameCooldownDays ?? 30,
                  hold: limits?.usernameHoldDays ?? 90,
                })}
              </li>
            </ul>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondaryButton} disabled={usernameBusy} onClick={() => setConfirming(false)}>
                {t('settings.confirm.cancel')}
              </button>
              <button type="button" className={styles.primaryButton} disabled={usernameBusy} onClick={submitUsername}>
                {usernameBusy ? t('common.loading') : t('settings.confirm.ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

export default function ProfileSettings() {
  return (
    <RequireAuth>
      <ProfileSettingsForm />
    </RequireAuth>
  )
}
