import { useRef, useState } from 'react'
import { ImagePlus, RotateCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth/AuthContext'
import { uploadFile } from '../services/upload/api'
import styles from './CoverDropzone.module.css'

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

interface Props {
  value: string | null
  onChange: (url: string | null) => void
}

/** Загрузка обложки: drag&drop или клик, превью сразу (до ответа сервера), прогресс, retry при ошибке. */
export default function CoverDropzone({ value, onChange }: Props) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      setError(t('creator.cover.invalidType'))
      return
    }
    if (file.size > MAX_SIZE) {
      setError(t('creator.cover.tooLarge'))
      return
    }

    setError(null)
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setProgress(0)

    try {
      const result = await uploadFile(token!, file, 'covers', setProgress)
      onChange(result.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creator.cover.uploadFailed'))
    } finally {
      setProgress(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  const shownUrl = previewUrl ?? value

  return (
    <div
      className={`${styles.zone} ${dragActive ? styles.zoneActive : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className={styles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload(file)
          e.target.value = ''
        }}
      />

      {shownUrl ? (
        <>
          <img src={shownUrl} alt="" className={styles.preview} />
          {progress === null && !error && (
            <button
              type="button"
              className={styles.removeButton}
              onClick={(e) => {
                e.stopPropagation()
                setPreviewUrl(null)
                onChange(null)
              }}
              aria-label={t('creator.cover.remove') ?? ''}
            >
              <X size={14} />
            </button>
          )}
        </>
      ) : (
        <div className={styles.placeholder}>
          <ImagePlus size={28} />
          <span>{t('creator.cover.prompt')}</span>
        </div>
      )}

      {progress !== null && (
        <div className={styles.progressOverlay}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <div className={styles.errorOverlay}>
          <span>{error}</span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={(e) => {
              e.stopPropagation()
              if (pendingFile) upload(pendingFile)
            }}
          >
            <RotateCw size={13} />
            {t('creator.retry')}
          </button>
        </div>
      )}
    </div>
  )
}
