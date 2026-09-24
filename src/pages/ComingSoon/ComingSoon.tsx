import { useTranslation } from 'react-i18next'
import MainLayout from '../../layouts/MainLayout'
import styles from './ComingSoon.module.css'

/**
 * Заглушка для разделов, которые ещё не реализованы (см. docs/ROADMAP.md).
 * После сессии 2026-07-26 остался только "Загрузки" (офлайн-режим) —
 * намеренно отложен: требует скачивания и хранения картинок на устройстве
 * пользователя, это отдельная задача v3 (см. ARCHITECTURE.md, принцип
 * "ничего не храним и не скачиваем сами"). Также используется как 404-страница.
 * Принимает ключи переводов (не готовые строки), чтобы текст следовал за
 * выбранным языком интерфейса.
 */
export default function ComingSoon({ labelKey, descriptionKey }: { labelKey: string; descriptionKey?: string }) {
  const { t } = useTranslation()
  return (
    <MainLayout>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t('comingSoon.eyebrow')}</p>
        <h1 className={styles.title}>{t(labelKey)}</h1>
        <p className={styles.text}>{t(descriptionKey ?? 'comingSoon.defaultDescription')}</p>
      </div>
    </MainLayout>
  )
}
