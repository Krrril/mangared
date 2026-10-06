import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Что показать вместо упавшего поддерева. По умолчанию — ничего (используется для мелких, некритичных кусков вроде одной обложки). */
  fallback?: ReactNode
  /** true — показать общий экран "Что-то пошло не так" с кнопкой обновить (для корневой границы вокруг всего приложения). */
  fullPage?: boolean
}

interface State {
  hasError: boolean
}

/**
 * Страховка от белого/чёрного экрана на всё приложение (см. задачу —
 * инцидент, когда необработанное исключение в рендере одного компонента
 * (ImageWithRetry) роняло React целиком, не оставляя на экране вообще
 * ничего). React не даёt поймать ошибку рендера хуком — только классовым
 * компонентом с componentDidCatch/getDerivedStateFromError, отсюда класс,
 * а не функция, несмотря на то что весь остальной код — функциональные
 * компоненты.
 *
 * Используется дважды: один раз вокруг всего приложения в App.tsx
 * (fullPage — страница "Что-то пошло не так" с кнопкой обновить вместо
 * пустого экрана) и отдельно вокруг каждой обложки/картинки (fallback —
 * тихо ничего не показывает, не роняя всю страницу из-за одной карточки).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary поймал ошибку рендера:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fullPage) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            minHeight: '100vh',
            padding: 24,
            textAlign: 'center',
            background: '#0a0a0f',
            color: '#f5f5f7',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Что-то пошло не так</p>
          <p style={{ fontSize: 14, color: '#9b99a8', margin: 0, maxWidth: 360 }}>
            Страница не смогла отрисоваться. Попробуйте обновить её — обычно это помогает.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: '#4caf7d',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Обновить страницу
          </button>
        </div>
      )
    }
    return this.props.fallback ?? null
  }
}
