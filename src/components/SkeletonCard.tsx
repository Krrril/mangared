import styles from './SkeletonCard.module.css'

/** Плейсхолдер карточки тайтла на время первой загрузки каталога (см. Home.tsx) — тех же пропорций, что и TitleCard. */
export default function SkeletonCard() {
  return (
    <div className={styles.card}>
      <div className={styles.cover} />
      <div className={styles.line} />
      <div className={styles.lineShort} />
    </div>
  )
}
