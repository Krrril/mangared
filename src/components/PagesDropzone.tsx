import { useRef, useState } from 'react'
import { UploadCloud, RotateCw, X, ChevronUp, ChevronDown, RefreshCw, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

interface RowProps {
  item: PageItem
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onReplace: () => void
  onRemove: () => void
  onRetry: () => void
}

/** Общее содержимое строки — одинаковое что в drag-and-drop, что в обычном (тач) режиме, см. компонент ниже. */
function PageRowContent({ item, index, total, onMoveUp, onMoveDown, onReplace, onRemove, onRetry }: RowProps) {
  const { t } = useTranslation()
  return (
    <>
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
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              <RotateCw size={12} />
              {t('creator.retry')}
            </button>
          </div>
        )}
        {item.url && !item.error && <span className={styles.itemDone}>{t('creator.pages.done')}</span>}
      </div>

      <div className={styles.itemActions}>
        <button type="button" onClick={onMoveUp} disabled={index === 0} aria-label={t('creator.pages.moveUp') ?? ''}>
          <ChevronUp size={16} />
        </button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1} aria-label={t('creator.pages.moveDown') ?? ''}>
          <ChevronDown size={16} />
        </button>
        <button type="button" onClick={onReplace} aria-label={t('creator.pages.replace') ?? ''} title={t('creator.pages.replace') ?? ''}>
          <RefreshCw size={14} />
        </button>
        <button type="button" onClick={onRemove} aria-label={t('creator.pages.remove') ?? ''}>
          <X size={16} />
        </button>
      </div>
    </>
  )
}

/** Строка без drag-and-drop — тач-устройства, поведение не менялось ни на йоту (см. задачу про DnD). */
function PlainPageRow(props: RowProps) {
  return (
    <li className={styles.item}>
      <PageRowContent {...props} />
    </li>
  )
}

/**
 * Строка с drag-and-drop (см. useSortable) — рендерится только когда
 * supportsDrag (см. компонент ниже). Отдельная "ручка" (GripVertical) —
 * не вся строка — чтобы клик по кнопкам действий не запускал перетаскивание.
 */
function SortablePageRow(props: RowProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id })

  // Масштаб при перетаскивании (см. .itemDragging в PagesDropzone.module.css)
  // должен идти в этом же inline transform — инлайн-стиль всегда перебивает
  // transform из CSS-класса, дублировать его там смысла нет.
  const dragTransform = [CSS.Transform.toString(transform), isDragging ? 'scale(1.02)' : null].filter(Boolean).join(' ')

  return (
    <li
      ref={setNodeRef}
      style={{ transform: dragTransform || undefined, transition }}
      className={`${styles.item} ${isDragging ? styles.itemDragging : ''}`}
    >
      <button type="button" className={styles.dragHandle} aria-label={t('creator.pages.dragHandle') ?? ''} {...attributes} {...listeners}>
        <GripVertical size={16} />
      </button>
      <PageRowContent {...props} />
    </li>
  )
}

/**
 * Загрузка/правка страниц главы — можно перетащить сразу несколько файлов
 * или добавлять по одному (каждая грузится независимо, свой прогресс/
 * retry). Порядок переставляется стрелками вверх/вниз везде, и
 * дополнительно — перетаскиванием мышкой (см. SortablePageRow) только на
 * устройствах с точным указателем (hover:hover + pointer:fine, см.
 * supportsDrag ниже): на тач-экранах drag-and-drop работает плохо
 * (случайные скроллы вместо перетаскивания), поэтому там остаются только
 * стрелки — ничего не меняется в их поведении. Если передан initialPages —
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
  // Читаем один раз при монтировании — реальные значения hover/pointer не
  // меняются на лету на одном и том же устройстве (в отличие от ширины
  // окна), поэтому обычный matchMedia().matches достаточен, без слушателя.
  const [supportsDrag] = useState(() => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id)
      const newIndex = prev.findIndex((i) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      emitChange(next)
      return next
    })
  }

  function rowProps(item: PageItem, index: number): RowProps {
    return {
      item,
      index,
      total: items.length,
      onMoveUp: () => moveItem(index, -1),
      onMoveDown: () => moveItem(index, 1),
      onReplace: () => {
        replaceTargetId.current = item.id
        replaceInputRef.current?.click()
      },
      onRemove: () => removeItem(item.id),
      onRetry: () => retryItem(item.id),
    }
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

      {items.length > 0 &&
        (supportsDrag ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className={styles.list}>
                {items.map((item, index) => (
                  <SortablePageRow key={item.id} {...rowProps(item, index)} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        ) : (
          <ol className={styles.list}>
            {items.map((item, index) => (
              <PlainPageRow key={item.id} {...rowProps(item, index)} />
            ))}
          </ol>
        ))}
    </div>
  )
}
