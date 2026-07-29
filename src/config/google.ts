/*
  Client ID для входа через Google — не секретный, можно смело хранить
  в переменной окружения фронтенда. Пока не задан (см. .env.example) —
  кнопка "Войти через Google" нигде не показывается, вместо неё честно
  ничего нет, а не сломанная кнопка.
*/
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined
