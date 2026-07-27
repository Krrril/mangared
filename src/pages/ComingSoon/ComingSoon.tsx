import MainLayout from '../../layouts/MainLayout'
import styles from './ComingSoon.module.css'

/**
 * Заглушка для разделов, которые ещё не реализованы (см. docs/ROADMAP.md).
 * После сессии 2026-07-26 остался только "Загрузки" (офлайн-режим) —
 * намеренно отложен: требует скачивания и хранения картинок на устройстве
 * пользователя, это отдельная задача v3 (см. ARCHITECTURE.md, принцип
 * "ничего не храним и не скачиваем сами").
 */
export default function ComingSoon({ label, description }: { label: string; description?: string }) {
  return (
    <MainLayout>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Скоро</p>
        <h1 className={styles.title}>{label}</h1>
        <p className={styles.text}>{description ?? 'Этот раздел ещё не реализован в MVP — см. docs/ROADMAP.md.'}</p>
      </div>
    </MainLayout>
  )
}
