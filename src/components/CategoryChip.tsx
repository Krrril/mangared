import { Link } from 'react-router-dom'
import styles from './CategoryChip.module.css'

export default function CategoryChip({ id, label }: { id: string; label: string }) {
  return (
    <Link to={`/search?genre=${id}&label=${encodeURIComponent(label)}`} className={styles.chip}>
      {label}
    </Link>
  )
}
