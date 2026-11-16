import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../services/auth/AuthContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import {
  broadcastPremiumMessage,
  fetchPremiumOverview,
  fetchPremiumRecipientsCount,
  grantAdminPremium,
  revokeAdminPremium,
  searchPremiumUsers,
  sendPremiumMessage,
} from '../../services/admin/api'
import type { PremiumGrantTerm, PremiumHolder, PremiumRecentGrant, PremiumUserEntry } from '../../services/admin/api'
import PremiumStatus from './PremiumStatus'
import styles from './PremiumAdmin.module.css'

/** Меньше символов — поиск не запускаем (и сервер пустой список вернёт): всю базу не грузим. */
const MIN_QUERY = 2

/** Лимит сообщения пользователю (совпадает с PREMIUM_MESSAGE_MAX на сервере). */
const MESSAGE_MAX = 1000

type Term = 7 | 30 | 90 | 365 | 'forever' | 'custom'
const TERMS: Term[] = [7, 30, 90, 365, 'forever', 'custom']

/** Многострочное поле сообщения пользователю со счётчиком символов. */
function MessageField({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  const { t } = useTranslation()
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <textarea
        className={styles.textarea}
        rows={4}
        maxLength={MESSAGE_MAX}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className={styles.counter}>{t('admin.premiumMessageCounter', { count: value.length, max: MESSAGE_MAX })}</span>
    </label>
  )
}

/** Отдельное сообщение пользователю, у которого Premium уже есть (срок не меняется). */
function MessageForm({ user, token }: { user: PremiumUserEntry; token: string }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function send() {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setStatus(null)
    try {
      await sendPremiumMessage(token, user.id, trimmed)
      setText('')
      setStatus({ kind: 'ok', text: t('admin.premiumMessageSent') })
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : t('admin.errDelete') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.form}>
      <MessageField value={text} onChange={setText} label={t('admin.premiumSendMessageTitle')} placeholder={t('admin.premiumMessagePlaceholder') ?? ''} />
      <div className={styles.formActions}>
        <button type="button" className={styles.primaryButton} disabled={busy || !text.trim()} onClick={send}>
          {busy ? t('common.loading') : t('admin.premiumSendMessage')}
        </button>
      </div>
      {status && (
        <p className={status.kind === 'ok' ? styles.hint : styles.error} role={status.kind === 'ok' ? 'status' : 'alert'}>
          {status.text}
        </p>
      )}
    </div>
  )
}

/** Массовое сообщение всем обладателям Premium: подтверждение числа получателей, защита от двойного клика и от повторов (сервер, 24 ч). */
function BroadcastBox({ token }: { token: string }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function send() {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setStatus(null)
    try {
      const { count } = await fetchPremiumRecipientsCount(token)
      if (count === 0) {
        setStatus({ kind: 'error', text: t('admin.premiumBroadcastNobody') })
        return
      }
      if (!window.confirm(t('admin.premiumBroadcastConfirm', { count }) ?? '')) return
      const res = await broadcastPremiumMessage(token, { message: trimmed, expectedCount: count })
      setText('')
      setStatus({ kind: 'ok', text: t('admin.premiumBroadcastDone', { count: res.recipients }) })
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : t('admin.errDelete') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.broadcast}>
      <h2 className={styles.heading}>{t('admin.premiumBroadcastTitle')}</h2>
      <p className={styles.hint}>{t('admin.premiumBroadcastHint')}</p>
      <MessageField value={text} onChange={setText} label={t('admin.premiumMessageLabel')} placeholder={t('admin.premiumMessagePlaceholder') ?? ''} />
      <div className={styles.formActions}>
        <button type="button" className={styles.primaryButton} disabled={busy || !text.trim()} onClick={send}>
          {busy ? t('common.loading') : t('admin.premiumBroadcastButton')}
        </button>
      </div>
      {status && (
        <p className={status.kind === 'ok' ? styles.hint : styles.error} role={status.kind === 'ok' ? 'status' : 'alert'}>
          {status.text}
        </p>
      )}
    </div>
  )
}

interface GrantFormProps {
  user: PremiumUserEntry
  token: string
  onChanged: () => void
}

/** Выдача/снятие Premium одному пользователю: срок, своя дата, заметка. У админа Premium по роли — форма заменена пояснением. */
function GrantForm({ user, token, onChanged }: GrantFormProps) {
  const { t } = useTranslation()
  const [term, setTerm] = useState<Term>(30)
  const [customDate, setCustomDate] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user.isAdmin) {
    return (
      <div className={styles.form}>
        <p className={styles.adminNote}>{t('admin.premiumAdminNote')}</p>
        <div className={styles.formActions}>
          <button type="button" className={styles.dangerButton} disabled aria-disabled="true" title={t('admin.premiumAdminNote') ?? ''}>
            {t('admin.premiumRevoke')}
          </button>
        </div>
        <MessageForm user={user} token={token} />
      </div>
    )
  }

  const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE')

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.errDelete'))
    } finally {
      setBusy(false)
    }
  }

  function grant() {
    let body: PremiumGrantTerm
    if (term === 'forever') body = { forever: true }
    else if (term === 'custom') body = { until: new Date(`${customDate}T23:59:59`).toISOString() }
    else body = { days: term }
    const trimmedNote = note.trim()
    const trimmedMessage = message.trim()
    return run(async () => {
      await grantAdminPremium(token, user.id, { ...body, ...(trimmedNote ? { note: trimmedNote } : {}), ...(trimmedMessage ? { message: trimmedMessage } : {}) })
      setMessage('')
    })
  }

  return (
    <div className={styles.form}>
      <div className={styles.chips} role="radiogroup" aria-label={t('admin.premiumGrant') ?? ''}>
        {TERMS.map((tm) => (
          <button
            key={tm}
            type="button"
            role="radio"
            aria-checked={term === tm}
            className={term === tm ? styles.chipActive : styles.chip}
            onClick={() => setTerm(tm)}
          >
            {tm === 'forever' ? t('admin.premiumForever') : tm === 'custom' ? t('admin.premiumCustomDate') : t('admin.premiumDays', { count: tm })}
          </button>
        ))}
      </div>

      {term === 'custom' && (
        <input
          type="date"
          className={styles.input}
          aria-label={t('admin.premiumCustomDate') ?? ''}
          min={minDate}
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
        />
      )}

      {user.isPremium && typeof term === 'number' && <p className={styles.hint}>{t('admin.premiumExtendHint')}</p>}

      <MessageField value={message} onChange={setMessage} label={t('admin.premiumMessageLabel')} placeholder={t('admin.premiumMessagePlaceholder') ?? ''} />
      <p className={styles.hint}>{t('admin.premiumMessageRevokeHint')}</p>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('admin.premiumNotePlaceholder')}</span>
        <input type="text" className={styles.input} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className={styles.formActions}>
        <button type="button" className={styles.primaryButton} disabled={busy || (term === 'custom' && !customDate)} onClick={grant}>
          {t('admin.premiumGrantConfirm')}
        </button>
        {user.isPremium && (
          <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => run(() => revokeAdminPremium(token, user.id, message.trim() || undefined))}>
            {t('admin.premiumRevoke')}
          </button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {user.isPremium && <MessageForm user={user} token={token} />}
    </div>
  )
}

interface UserCardProps {
  user: PremiumUserEntry
  token: string
  open: boolean
  onToggle: () => void
  onChanged: () => void
  meta?: string | null
}

function UserCard({ user, token, open, onToggle, onChanged, meta }: UserCardProps) {
  const { t } = useTranslation()
  return (
    <li className={styles.card}>
      <div className={styles.cardMain}>
        <span className={styles.avatar} aria-hidden="true">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : user.name.charAt(0).toUpperCase()}
        </span>
        <div className={styles.cardInfo}>
          <p className={styles.cardName}>{user.name}</p>
          <p className={styles.cardSub}>{user.username ? `@${user.username} · ${user.email}` : user.email}</p>
          {meta && <p className={styles.cardSub}>{meta}</p>}
          <PremiumStatus u={user} />
        </div>
        <button type="button" className={styles.manageButton} aria-expanded={open} onClick={onToggle}>
          {t('admin.premiumManage')}
        </button>
      </div>
      {open && <GrantForm user={user} token={token} onChanged={onChanged} />}
    </li>
  )
}

/** Вкладка "Premium": поиск пользователя на сервере → выдать/продлить/снять; ниже — текущие обладатели и последние выдачи. */
export default function PremiumAdmin() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query.trim(), 350)
  const [results, setResults] = useState<PremiumUserEntry[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [overview, setOverview] = useState<{ holders: PremiumHolder[]; recent: PremiumRecentGrant[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // Увеличиваем после каждого изменения Premium — перезапрашивает и поиск, и обзор.
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchPremiumOverview(token)
      .then((o) => !cancelled && setOverview(o))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [token, nonce])

  useEffect(() => {
    if (!token) return
    if (debounced.length < MIN_QUERY) {
      setResults(null)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    searchPremiumUsers(token, debounced)
      .then((r) => !cancelled && setResults(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setSearching(false))
    return () => {
      cancelled = true
    }
  }, [token, debounced, nonce])

  if (!token) return null

  function metaFor(h: PremiumHolder): string | null {
    if (!h.grantedByName) return null
    const when = h.grantedAt ? ` · ${new Date(h.grantedAt).toLocaleDateString()}` : ''
    return `${t('admin.premiumGrantedBy', { name: h.grantedByName })}${when}`
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.searchRow}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          placeholder={t('admin.premiumSearchPlaceholder') ?? ''}
          aria-label={t('admin.premiumSearchPlaceholder') ?? ''}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {query.trim().length > 0 && query.trim().length < MIN_QUERY && <p className={styles.hint}>{t('admin.premiumSearchHint')}</p>}
      {searching && <p className={styles.hint}>{t('common.loading')}</p>}
      {!searching && results && results.length === 0 && <p className={styles.hint}>{t('admin.premiumNoResults')}</p>}

      {results && results.length > 0 && (
        <ul className={styles.list}>
          {results.map((u) => (
            <UserCard key={u.id} user={u} token={token} open={openId === `s:${u.id}`} onToggle={() => setOpenId((c) => (c === `s:${u.id}` ? null : `s:${u.id}`))} onChanged={refresh} />
          ))}
        </ul>
      )}

      <BroadcastBox token={token} />

      <h2 className={styles.heading}>{t('admin.premiumHolders', { count: overview?.holders.length ?? 0 })}</h2>
      {overview && overview.holders.length === 0 && <p className={styles.hint}>{t('admin.premiumNoHolders')}</p>}
      {overview && overview.holders.length > 0 && (
        <ul className={styles.list}>
          {overview.holders.map((h) => (
            <UserCard
              key={h.id}
              user={h}
              token={token}
              meta={metaFor(h)}
              open={openId === `h:${h.id}`}
              onToggle={() => setOpenId((c) => (c === `h:${h.id}` ? null : `h:${h.id}`))}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}

      <h2 className={styles.heading}>{t('admin.premiumRecent')}</h2>
      {overview && overview.recent.length === 0 && <p className={styles.hint}>{t('admin.premiumNoRecent')}</p>}
      {overview && overview.recent.length > 0 && (
        <ul className={styles.recentList}>
          {overview.recent.map((g) => (
            <li key={g.id} className={styles.recentItem}>
              <p className={styles.recentTop}>
                <strong>{g.userName}</strong> <span className={styles.cardSub}>{g.userEmail}</span>
              </p>
              <p className={styles.cardSub}>
                {g.revoked ? t('admin.premiumRevokedEntry') : g.forever ? t('admin.premiumForever') : t('admin.premiumUntil', { date: new Date(g.until).toLocaleDateString() })}
                {' · '}
                {t('admin.premiumGrantedBy', { name: g.grantedByName })}
                {' · '}
                {new Date(g.createdAt).toLocaleString()}
              </p>
              {g.note && <p className={styles.recentNote}>{g.note}</p>}
              {g.message && (
                <p className={styles.recentNote}>
                  {t('admin.premiumRecentMessage')}: {g.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
