// Общий ключ токена — используется и в AuthContext (для React-состояния),
// и в services/favorites и services/progress (обычные модули вне дерева
// React, им проще читать localStorage напрямую, чем тянуть контекст).
export const TOKEN_KEY = 'mangared:token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
