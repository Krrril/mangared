import { useEffect, useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../services/auth/AuthContext'
import { getReactions, setReaction } from '../services/reactions/api'
import type { ReactionSummary } from '../services/reactions/api'
import styles from './ReactionButtons.module.css'

interface Props {
  mangaId: string
  /** Отсутствует — реакция на тайтл целиком; задан — на конкретную главу (см. задачу). */
  chapterId?: string
}

/** Лайк/дизлайк — один голос на пользователя, повторный клик по своей же реакции снимает голос (см. routes/reactions.ts). */
export default function ReactionButtons({ mangaId, chapterId }: Props) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [summary, setSummary] = useState<ReactionSummary>({ likes: 0, dislikes: 0, myReaction: null })
  const [pending, setPending] = useState(false)

  useEffect(() => {
    getReactions(mangaId, chapterId, token).then(setSummary)
  }, [mangaId, chapterId, token])

  async function handleClick(type: 'like' | 'dislike') {
    if (!token || pending) return
    setPending(true)
    try {
      setSummary(await setReaction(token, mangaId, type, chapterId))
    } finally {
      setPending(false)
    }
  }

  const loginTitle = token ? undefined : (t('reactions.loginRequired') ?? '')

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.button} ${summary.myReaction === 'like' ? styles.activeLike : ''}`}
        onClick={() => handleClick('like')}
        disabled={!token || pending}
        aria-pressed={summary.myReaction === 'like'}
        title={loginTitle}
      >
        <ThumbsUp size={15} fill={summary.myReaction === 'like' ? 'currentColor' : 'none'} />
        {summary.likes}
      </button>
      <button
        type="button"
        className={`${styles.button} ${summary.myReaction === 'dislike' ? styles.activeDislike : ''}`}
        onClick={() => handleClick('dislike')}
        disabled={!token || pending}
        aria-pressed={summary.myReaction === 'dislike'}
        title={loginTitle}
      >
        <ThumbsDown size={15} fill={summary.myReaction === 'dislike' ? 'currentColor' : 'none'} />
        {summary.dislikes}
      </button>
    </div>
  )
}
