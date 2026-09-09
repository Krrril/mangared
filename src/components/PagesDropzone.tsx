import { useRef, useState } from 'react'
import { UploadCloud, RotateCw, X, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth/AuthContext'
import { uploadFile } from '../services/upload/api'
import styles from './PagesDropzone.module.css'

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

interface PageItem {
  id: string
  // null — уже существующая страница (см. initialPages), пока её не заменили новым файлом.
  file: File | null
  previewUrl: string
  progress: number | null
  url: string | null
  error: string | null
}

interface Props {
  onChange: (urls: string[]) => void
  /**
   * Затравка уже загруженных страниц — режим правки существующей главы
   * (см. MangaDetail.tsx, "Управление страницами"), а не только загрузка
   * новой. Читается один раз при монтировании (компонент пересоздаётся
   * заново на каждый открытие редактора страниц конкретной главы — см.
   * key на месте использования), не отслеживается через useEffect.
   */
  initialPages?: string[]
}

/**
 * Загрузка/правка страниц главы — можно перетащить сразу несколько файлов
 * или добавлять по одному (каждая грузится независимо, свой прогресс/
 * retry), порядок переставляется стрелками вверх/вниз (без отдельной
 * drag-reorder библиотеки — тем же способом можно "вставить в середину":
 * добавить в конец и поднять на нужное место, что заодно куда удобнее на
 * тач-экране, чем настоящий drag-and-drop). Если передан initialPages —
 * дополнительно доступна замена конкретной уже загруженной страницы новым
 * файлом на том же месте (см. кнопку "заменить").
 */
export default function PagesDropzone({ onChange, initialPages }: Props) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetId = useRef<string | null>(null)
  const [items, setItems] = useState<PageItem[]>(() =>
    (initialPages ?? []).map((url) => ({
      id: `existing-${crypto.randomUUID()}`,
      file: null,
      previewUrl: url,
      progress: null,
      url,
      error: null,
    })),
  )
  const [dragActive, setDragActive] = useState(false)

  function emitChange(next: PageItem[]) {
    onChange(next.filter((i) => i.url).map((i) => i.url!))
  }

  async function uploadItem(item: PageItem) {
    if (!item.file) return
    try {
      const result = await uploadFile(token!, item.file, 'pages', (percent) => {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i)))
      })
      setItems((prev) => {
        const next = prev.map((i) => (i.id === item.id ? { ...i, progress: null, url: result.url, error: null } : i))
        emitChange(next)
        return next
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('creator.pages.uploadFailed')
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: null, error: message } : i)))
    }
  }

  function addFiles(files: FileList | File[]) {
    const accepted: PageItem[] = []
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type) || file.size > MAX_SIZE) continue
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        url: null,
        error: null,
      })
    }
    if (accepted.length === 0) return
    setItems((prev) => [...prev, ...accepted])
    accepted.forEach(uploadItem)
  }

  function replaceFile(id: string, file: File) {
    if (!ACCEPTED.includes(file.type) || file.size > MAX_SIZE) return
    const replacement: PageItem = {
      id,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      url: null,
      error: null,
    }
    setItems((prev) => prev.map((i) => (i.id === id ? replacement : i)))
    uploadItem(replacement)
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      emitChange(next)
      return next
    })
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id)
      emitChange(next)
      return next
    })
  }

  function retryItem(id: string) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, error: null, progress: 0 } : i)))
    uploadItem(item)
  }

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.dropArea} ${dragActive ? styles.dropAreaActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          className={styles.hiddenInput}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <UploadCloud size={24} />
        <span>{t('creator.pages.prompt')}</span>
      </div>

      {/* Один общий скрытый input для замены — какую именно страницу заменить, помнит replaceTargetId. */}
      <input
        ref={replaceInputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className={styles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0]
          const id = replaceTargetId.current
          if (file && id) replaceFile(id, file)
          e.target.value = ''
          replaceTargetId.current = null
        }}
      />

      {items.length > 0 && (
        <ol className={styles.list}>
          {items.map((item, index) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.pageNumber}>{index + 1}</span>
              <img src={item.previewUrl} alt="" className={styles.thumb} />

              <div className={styles.itemBody}>
                {item.progress !== null && (
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBar} style={{ width: `${item.progress}%` }} />
                  </div>
                )}
                {item.error && (
                  <div className={styles.itemError}>
                    <span>{item.error}</span>
                    <button type="button" className={styles.retryButton} onClick={() => retryItem(item.id)}>
                      <RotateCw size={12} />
                      {t('creator.retry')}
                    </button>
                  </div>
                )}
                {item.url && !item.error && <span className={styles.itemDone}>{t('creator.pages.done')}</span>}
              </div>

              <div className={styles.itemActions}>
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label={t('creator.pages.moveUp') ?? ''}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={t('creator.pages.moveDown') ?? ''}
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    replaceTargetId.current = item.id
                    replaceInputRef.current?.click()
                  }}
                  aria-label={t('creator.pages.replace') ?? ''}
                  title={t('creator.pages.replace') ?? ''}
                >
                  <RefreshCw size={14} />
                </button>
                <button type="button" onClick={() => removeItem(item.id)} aria-label={t('creator.pages.remove') ?? ''}>
                  <X size={16} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
