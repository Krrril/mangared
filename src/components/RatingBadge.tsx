import { Star } from 'lucide-react'
import styles from './RatingBadge.module.css'

export default function RatingBadge({ rating }: { rating: number }) {
  return (
    <span className={styles.badge}>
      <Star size={12} fill="currentColor" />
      {rating.toFixed(1)}
    </span>
  )
}
