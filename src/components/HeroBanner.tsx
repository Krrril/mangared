import TitleCard from './TitleCard'
import type { Title } from '../services/content/types'
import styles from './HeroBanner.module.css'

/**
 * Секция "Популярное" на главной — сетка крупных карточек (см. задачу про
 * редизайн). Раньше здесь был один слайд с автопрокруткой (см. git-историю
 * компонента) — заменено на сетку, показывающую сразу несколько тайтлов,
 * тот же приём "приподнятия" при наведении, что и у TitleCard size='large'.
 * Плашка "Популярное" — тот же текст и внешний вид (не переименовывать,
 * не переводить через i18n), просто перенесена с уровня слайда на уровень
 * секции.
 */
export default function HeroBanner({ titles }: { titles: Title[] }) {
  if (titles.length === 0) return null

  return (
    <section>
      <span className={styles.badge}>Популярное</span>
      <div className={styles.grid}>
        {titles.map((title) => (
          <TitleCard key={title.id} title={title} size="large" />
        ))}
      </div>
    </section>
  )
}
