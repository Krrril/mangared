import { useState } from 'react'
import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { forceAdminIdentity } from '../../services/admin/api'
import type { AdminUser } from '../../services/admin/api'
import styles from './AdminIdentityModal.module.css'

interface Props {
  user: AdminUser
  token: string
  onClose: () => void
  /** Вызывается после успешного сохранения — родитель обновляет список. */
  onSaved: () => void
}

/**
 * Принудительная смена ника и/или имени пользователя админом и сброс
 * ограничений (30 дней на ник, 7 на имя). Админу разрешены и
 * зарезервированные слова; формат и уникальность сервер проверяет всегда.
 */
export default function AdminIdentityModal({ user, token, onClose, onSaved }: Props) {
  const { t, i18n } = useTranslation()
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [resetLimits, setResetLimits] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string[] | null>(null)

  const date = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString(i18n.resolvedLanguage ?? i18n.language) : t('admin.identity.never')

  const nothingToDo = !username.trim() && !name.trim() && !resetLimits

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || nothingToDo) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await forceAdminIdentity(token, user.id, {
        ...(username.trim() ? { username: username.trim() } : {}),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(resetLimits ? { resetLimits: true } : {}),
      })
      setDone(res.changes)
      setUsername('')
      setName('')
      setResetLimits(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="identity-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('a11y.close') ?? ''}>
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id="identity-title" className={styles.title}>
          {t('admin.identity.title')}
        </h2>
        <dl className={styles.facts}>
          <dt>{t('admin.identity.currentNick')}</dt>
          <dd>{user.username ? `@${user.username}` : '—'}</dd>
          <dt>{t('admin.identity.currentName')}</dt>
          <dd>{user.displayName ?? user.name}</dd>
          <dt>{t('admin.identity.nickChanged')}</dt>
          <dd>{date(user.usernameChangedAt)}</dd>
          <dt>{t('admin.identity.nameChanged')}</dt>
          <dd>{date(user.nameChangedAt)}</dd>
        </dl>

        <form onSubmit={submit}>
          <label className={styles.field}>
            <span>{t('admin.identity.newNick')}</span>
            <input
              type="text"
              value={username}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={21}
              placeholder={user.username ?? ''}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>{t('admin.identity.newName')}</span>
            <input type="text" value={name} maxLength={40} placeholder={user.displayName ?? user.name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={resetLimits} onChange={(e) => setResetLimits(e.target.checked)} />
            <span>{t('admin.identity.resetLimits')}</span>
          </label>
          <p className={styles.note}>{t('admin.identity.note')}</p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className={styles.ok} role="status">
              {done.length > 0 ? `${t('admin.identity.saved')}: ${done.join('; ')}` : t('admin.identity.nothingChanged')}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              {t('admin.identity.close')}
            </button>
            <button type="submit" className={styles.primary} disabled={busy || nothingToDo}>
              {busy ? t('common.loading') : t('admin.identity.apply')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
