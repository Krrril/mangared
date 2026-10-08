import { TELEGRAM_URL } from './links'

/*
  Контакты для связи — показываются на странице входа и в подвале
  сайдбара. Discord пока заглушка: подставьте ссылку, когда будет
  готов сервер. Telegram берётся из links.ts — там же его используют
  промо-карточки CTA (см. TelegramCta.tsx), чтобы адрес не расходился.
*/
export const CONTACTS = {
  telegram: TELEGRAM_URL as string | undefined,
  discord: undefined as string | undefined, // например: 'https://discord.gg/xxxxxxx'
  email: 'support@mangagreen.app', // замените на реальный адрес
}
