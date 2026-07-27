import styles from './ProgressBar.module.css'

export default function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className={styles.track}>
      <div className={styles.fill} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  )
}
