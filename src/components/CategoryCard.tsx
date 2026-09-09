import { Link } from 'react-router-dom'
import styles from './CategoryCard.module.css'

interface Props {
  genreId: string
  mangadexTagId: string
  label: string
  /** undefined, пока /originals/category-images ещё не ответил или для жанра не нашлось обложки — тогда просто фирменный градиент без картинки. */
  imageUrl?: string
}

/**
 * Карточка категории — обложка самого популярного тайтла с этим жанром
 * (см. GET /originals/category-images, services/categoryImages.ts на
 * бэкенде) с затемняющим градиентом и названием поверх. Ведёт на общий
 * поиск/каталог, отфильтрованный по этому жанру — тот же маршрут, что и
 * прежние текстовые чипсы (см. CategoryChip.tsx), просто другой внешний
 * вид. Эффект приподнятия при наведении/тапе — тот же язык, что у крупных
 * карточек тайтлов в "Недавно добавленные" (см. TitleCard.module.css,
 * .cardLarge) — здесь свой CSS-класс, а не общий компонент, потому что
 * пропорции и содержимое карточки совсем другие (широкая плитка с
 * текстом поверх фото, а не портретная обложка).
 */
export default function CategoryCard({ mangadexTagId, label, imageUrl }: Props) {
  return (
    <Link to={`/search?genre=${mangadexTagId}&label=${encodeURIComponent(label)}`} className={styles.card}>
      <div className={styles.imageWrap} style={!imageUrl ? { background: 'var(--accent-gradient)' } : undefined}>
        {imageUrl && <img src={imageUrl} alt="" className={styles.image} loading="lazy" referrerPolicy="no-referrer" />}
        <div className={styles.gradient} />
      </div>
      <span className={styles.label}>{label}</span>
    </Link>
  )
}
