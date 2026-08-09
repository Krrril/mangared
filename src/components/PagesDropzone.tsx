import { useRef, useState } from 'react'
import { UploadCloud, RotateCw, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth/AuthContext'
import { uploadFile } from '../services/upload/api'
import styles from './PagesDropzone.module.css'

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

interface PageItem {
  id: string
  file: File
  previewUrl: string
  progress: number | null
  url: string | null
  error: string | null
}

interface Props {
  onChange: (urls: string[]) => void
}

/**
 * Загрузка страниц главы — можно перетащить сразу несколько файлов или
 * добавлять по одному, каждая грузится независимо (свой прогресс/retry),
 * порядок — как в списке, переставляется стрелками вверх/вниз (без
 * отдельной drag-reorder библиотеки — вверх/вниз тоже "с сортировкой",
 * но без лишней зависимости).
 */
export default function PagesDropzone({ onChange }: Props) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<PageItem[]>([])
  const [dragActive, setDragActive] = useState(false)

  function emitChange(next: PageItem[]) {
    onChange(next.filter((i) => i.url).map((i) => i.url!))
  }

  async function uploadItem(item: PageItem) {
    try {
      const result = await uploadFile(token!, item.file, 'pages', (percent) => {
        setItems((prev) => {
          const next = prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i))
          return next
        })
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
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={t('creator.pages.moveDown') ?? ''}
                >
                  <ChevronDown size={14} />
                </button>
                <button type="button" onClick={() => removeItem(item.id)} aria-label={t('creator.pages.remove') ?? ''}>
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
