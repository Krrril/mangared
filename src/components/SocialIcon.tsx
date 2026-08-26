import { Link2 } from 'lucide-react'

interface IconProps {
  size: number
}

/*
  Простые monochrome-силуэты (currentColor), не точные брендовые логотипы —
  этого достаточно, чтобы платформа узнавалась с первого взгляда рядом с
  подписью автора, без юридических рисков копирования защищённых лого-файлов.
  Сопоставление — по вхождению названия платформы в подпись автора
  (см. matchIcon ниже), поэтому работает и для "Мой Telegram-канал" и т.п.
*/

function TelegramIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M21.5 4.5 2.9 11.8c-1.2.5-1.2 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.5 0 .7-.2 1-.5l2.4-2.3 5 3.6c.9.5 1.6.2 1.8-.8l3.3-15.4c.3-1.3-.5-1.9-1.4-1.3Z"
        fill="currentColor"
      />
      <path d="m8.7 15 9.5-7.9c.4-.4 0-.5-.6-.2L7.2 13.6l-.3 3.7 2.2-2.1" fill="var(--bg-surface, #1a1a24)" />
    </svg>
  )
}

function InstagramIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TikTokIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 3c.4 2.2 1.8 3.6 4 3.9v2.8c-1.5 0-2.9-.4-4-1.2v6.6c0 3.3-2.7 5.9-6 5.9s-6-2.6-6-5.9 2.7-5.9 6-5.9c.4 0 .8 0 1.1.1v2.9a3 3 0 1 0 2.1 2.9V3h2.8Z" />
    </svg>
  )
}

function YouTubeIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" fill="currentColor" />
      <path d="M10.5 9.3v5.4l5-2.7-5-2.7Z" fill="var(--bg-surface, #1a1a24)" />
    </svg>
  )
}

function DiscordIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.9 6.4A16 16 0 0 0 15 5.2l-.3.6a13 13 0 0 1 3.4 1.3 14.6 14.6 0 0 0-12.2 0 13 13 0 0 1 3.4-1.3L9 5.2a16 16 0 0 0-3.9 1.2C2.9 9.7 2.3 13 2.6 16.2a16.3 16.3 0 0 0 4.9 2.5l.8-1.3a10.4 10.4 0 0 1-1.6-.8l.4-.3a11.6 11.6 0 0 0 9.8 0l.4.3c-.5.3-1 .6-1.6.8l.8 1.3a16.2 16.2 0 0 0 4.9-2.5c.4-3.7-.6-7-2.5-9.8ZM9.7 14.4c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Zm4.6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Z" />
    </svg>
  )
}

function VkIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
      <path
        d="M12.8 16.6c-4.3 0-6.8-3-6.9-7.8h2.3c.1 3.4 1.6 4.9 2.7 5.1V8.8h2.2v3.1c1.2-.1 2.4-1.4 2.8-3.1h2.2c-.3 2-1.7 3.4-2.7 4 1 .5 2.6 1.7 3.2 3.8h-2.4c-.5-1.6-1.7-2.7-3.3-2.9v2.9h-.1Z"
        fill="var(--bg-surface, #1a1a24)"
      />
    </svg>
  )
}

function XIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l7.2 9.5L4.3 20h2.3l5.8-5.6 4.4 5.6H20l-7.5-9.8L19 4h-2.3l-5.3 5.2L7.7 4H4Z" />
    </svg>
  )
}

/** Донат-платформы без общеизвестного простого силуэта — монограмма в кружке. */
function Monogram({ size, letter }: IconProps & { letter: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10.5" fill="currentColor" />
      <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--bg-surface, #1a1a24)">
        {letter}
      </text>
    </svg>
  )
}

const MATCHERS: [string, (props: IconProps) => JSX.Element][] = [
  ['telegram', TelegramIcon],
  ['instagram', InstagramIcon],
  ['tiktok', TikTokIcon],
  ['youtube', YouTubeIcon],
  ['discord', DiscordIcon],
  ['вконтакте', VkIcon],
  ['vkontakte', VkIcon],
  ['vk', VkIcon],
  ['twitter', XIcon],
  ['boosty', (p) => <Monogram {...p} letter="B" />],
  ['patreon', (p) => <Monogram {...p} letter="P" />],
  ['donationalerts', (p) => <Monogram {...p} letter="D" />],
]

function matchIcon(label: string) {
  const key = label.toLowerCase().replace(/[\s._-]+/g, '')
  for (const [pattern, Icon] of MATCHERS) {
    if (key.includes(pattern)) return Icon
  }
  return null
}

interface Props {
  label: string
  size?: number
}

/** Иконка платформы по подписи ссылки — узнаваемый силуэт для частых соцсетей/донатов, иначе — обычная иконка ссылки. */
export default function SocialIcon({ label, size = 18 }: Props) {
  const Icon = matchIcon(label)
  if (Icon) return <Icon size={size} />
  return <Link2 size={size} />
}
