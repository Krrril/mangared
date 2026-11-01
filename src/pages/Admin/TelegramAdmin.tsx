import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../services/auth/AuthContext'
import { API_BASE } from '../../config/api'
import {
  deleteLastTelegramDigest,
  fetchTelegramStatus,
  retryTelegramPost,
  sendTelegramTestDigest,
  sendTelegramTestMessage,
} from '../../services/admin/api'
import type { TelegramStatus } from '../../services/admin/api'
import styles from './TelegramAdmin.module.css'

type Busy = null | 'message' | 'digest' | 'delete' | string

/** Переменные Render: точные имена + ключ подсказки (admin.telegram.var*). */
const RENDER_VARS: [string, string][] = [
  ['TELEGRAM_BOT_TOKEN', 'varToken'],
  ['TELEGRAM_CHANNEL_ID', 'varChannel'],
  ['CRON_SECRET', 'varCron'],
  ['TELEGRAM_POST_ENABLED', 'varEnabled'],
  ['TELEGRAM_ORIGINALS_POSTS', 'varOriginals'],
  ['TELEGRAM_POST_LANG', 'varLang'],
  ['TELEGRAM_DIGEST_COVERS', 'varCovers'],
]

/*
  Вкладка «Telegram»: состояние автопубликации, тестовые отправки (беззвучно,
  в журнал не пишутся), удаление последней подборки, последние посты и
  ошибки с кнопкой «Повторить». Токен, канал и секрет сервер не отдаёт —
  только «задано / не задано».
*/
export default function TelegramAdmin() {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(() => {
    if (!token) return
    fetchTelegramStatus(token)
      .then((s) => {
        setStatus(s)
        setLoadError(false)
      })
      .catch(() => setLoadError(true))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const dateTime = (iso: string) => new Date(iso).toLocaleString(i18n.resolvedLanguage ?? i18n.language)

  async function run(kind: Busy, action: () => Promise<string>) {
    if (!token || busy) return
    setBusy(kind)
    setMessage(null)
    try {
      setMessage({ kind: 'ok', text: await action() })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : t('admin.telegram.errorGeneric') })
    } finally {
      setBusy(null)
      load()
    }
  }

  const sendTest = () =>
    run('message', async () => {
      await sendTelegramTestMessage(token!)
      return t('admin.telegram.testMessageSent')
    })

  const sendDigest = () =>
    run('digest', async () => {
      const r = await sendTelegramTestDigest(token!)
      if (r.skipped === 'no_items') return t('admin.telegram.digestNoItems')
      return t('admin.telegram.testDigestSent', { titles: r.titles, messages: r.messages })
    })

  const deleteDigest = () => {
    if (!window.confirm(t('admin.telegram.deleteDigestConfirm') ?? '')) return
    void run('delete', async () => {
      const r = await deleteLastTelegramDigest(token!)
      if (!r.ok) throw new Error(r.errors[0] ?? t('admin.telegram.errorGeneric'))
      return t('admin.telegram.digestDeleted', { messages: r.deletedMessages, titles: r.releasedTitles })
    })
  }

  const retry = (id: string) =>
    run(id, async () => {
      const r = await retryTelegramPost(token!, id)
      return r.message || t('admin.telegram.retryStarted')
    })

  if (loadError) return <div className={styles.state}>{t('admin.telegram.errorGeneric')}</div>
  if (!status) return <div className={styles.state}>{t('common.loading')}</div>

  const yesNo = (v: boolean) => (v ? t('admin.telegram.yes') : t('admin.telegram.no'))
  const actionsDisabled = !status.ready || busy !== null

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>{t('admin.telegram.statusTitle')}</h3>
          <span className={status.enabled ? styles.badgeOn : styles.badgeOff}>
            {status.enabled ? t('admin.telegram.enabled') : t('admin.telegram.disabled')}
          </span>
        </div>
        <dl className={styles.facts}>
          <dt>{t('admin.telegram.factToken')}</dt>
          <dd>{status.configured.token ? <Check size={14} aria-label={t('admin.telegram.yes') ?? ''} /> : <X size={14} aria-label={t('admin.telegram.no') ?? ''} />}</dd>
          <dt>{t('admin.telegram.factChannel')}</dt>
          <dd>{status.configured.channel ? <Check size={14} aria-label={t('admin.telegram.yes') ?? ''} /> : <X size={14} aria-label={t('admin.telegram.no') ?? ''} />}</dd>
          <dt>{t('admin.telegram.factCron')}</dt>
          <dd>{status.configured.cronSecret ? <Check size={14} aria-label={t('admin.telegram.yes') ?? ''} /> : <X size={14} aria-label={t('admin.telegram.no') ?? ''} />}</dd>
          <dt>{t('admin.telegram.factLang')}</dt>
          <dd>{status.lang.toUpperCase()}</dd>
          <dt>{t('admin.telegram.factDigestCovers')}</dt>
          <dd>{yesNo(status.digestCovers)}</dd>
          <dt>{t('admin.telegram.factOriginalsPosts')}</dt>
          <dd>{yesNo(status.originalsPosts === true)}</dd>
          <dt>{t('admin.telegram.factOriginalsCovers')}</dt>
          <dd>{yesNo(status.originalsCovers)}</dd>
          <dt>{t('admin.telegram.factPending')}</dt>
          <dd>{status.pendingChapters}</dd>
          <dt>{t('admin.telegram.factFailed')}</dt>
          <dd>{status.failedCount}</dd>
          <dt>{t('admin.telegram.factLastDigest')}</dt>
          <dd>
            {status.lastDigest
              ? t('admin.telegram.lastDigestValue', { date: dateTime(status.lastDigest.at), titles: status.lastDigest.titles })
              : '—'}
          </dd>
        </dl>
        {!status.ready && <p className={styles.note}>{t('admin.telegram.notReady')}</p>}
        {status.ready && !status.flagEnabled && <p className={styles.note}>{t('admin.telegram.flagOffNote')}</p>}
        {status.originalsPosts !== true && <p className={styles.note}>{t('admin.telegram.originalsPostsOffNote')}</p>}
        {status.originalsCovers === false && <p className={styles.note}>{t('admin.telegram.originalsNoCoverNote')}</p>}
      </section>

      <section className={styles.card}>
        <details className={styles.setup}>
          <summary className={styles.setupSummary}>{t('admin.telegram.setupTitle')}</summary>
          <p className={styles.note}>{t('admin.telegram.setupIntro')}</p>
          <p className={styles.warn}>{t('admin.telegram.setupSecretWarning')}</p>
          <dl className={styles.vars}>
            {RENDER_VARS.map(([name, hint]) => (
              <div key={name} className={styles.varRow}>
                <dt>
                  <code>{name}</code>
                </dt>
                <dd>{t(`admin.telegram.${hint}`)}</dd>
              </div>
            ))}
          </dl>
          <h4 className={styles.subTitle}>{t('admin.telegram.channelTitle')}</h4>
          <ol className={styles.steps}>
            {(['channelStep1', 'channelStep2', 'channelStep3', 'channelStep4'] as const).map((k) => (
              <li key={k}>{t(`admin.telegram.${k}`)}</li>
            ))}
          </ol>
          <h4 className={styles.subTitle}>{t('admin.telegram.cronTitle')}</h4>
          <p className={styles.note}>{t('admin.telegram.cronText', { url: `${API_BASE}/internal/telegram-digest` })}</p>
        </details>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{t('admin.telegram.actionsTitle')}</h3>
        <p className={styles.note}>{t('admin.telegram.testNote')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} disabled={actionsDisabled} onClick={sendTest}>
            {busy === 'message' ? t('common.loading') : t('admin.telegram.testMessage')}
          </button>
          <button type="button" className={styles.button} disabled={actionsDisabled || status.digestRunning} onClick={sendDigest}>
            {busy === 'digest' ? t('common.loading') : t('admin.telegram.testDigest')}
          </button>
          <button type="button" className={styles.dangerButton} disabled={actionsDisabled || !status.lastDigest} onClick={deleteDigest}>
            {busy === 'delete' ? t('common.loading') : t('admin.telegram.deleteDigest')}
          </button>
        </div>
        {message && (
          <p className={message.kind === 'ok' ? styles.ok : styles.error} role="status">
            {message.text}
          </p>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>{t('admin.telegram.postsTitle')}</h3>
          <button type="button" className={styles.iconButton} onClick={load} aria-label={t('admin.telegram.refresh') ?? ''} title={t('admin.telegram.refresh') ?? ''}>
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
        {status.posts.length === 0 ? (
          <p className={styles.note}>{t('admin.telegram.noPosts')}</p>
        ) : (
          <ul className={styles.posts}>
            {status.posts.map((p) => (
              <li key={p.id} className={styles.post}>
                <div className={styles.postMain}>
                  <span className={styles.postKind}>{t(`admin.telegram.kind.${p.kind}`, { defaultValue: p.kind })}</span>
                  <span className={styles.postLabel}>{p.label ?? p.refId}</span>
                  <span className={styles.postTime}>{dateTime(p.createdAt)}</span>
                </div>
                <div className={styles.postSide}>
                  <span className={p.status === 'failed' ? styles.statusFailed : p.status === 'sent' ? styles.statusSent : styles.statusOther}>
                    {t(`admin.telegram.status.${p.status}`, { defaultValue: p.status })}
                  </span>
                  {p.status === 'failed' && (
                    <button type="button" className={styles.button} disabled={busy !== null} onClick={() => retry(p.id)}>
                      {busy === p.id ? t('common.loading') : t('admin.telegram.retry')}
                    </button>
                  )}
                </div>
                {p.error && <p className={styles.postError}>{p.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
