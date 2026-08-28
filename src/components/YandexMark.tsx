/**
 * Условная марка Яндекса — красный круг с "Я", как и Telegram/Discord в
 * ContactsInline.tsx: Lucide не содержит фирменных логотипов, поэтому
 * узнаваемый, но не официальный ассет (не забираем брендовый SVG из чужого
 * пакета/сайта).
 */
export default function YandexMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9" cy="9" r="9" fill="#FC3F1D" />
      <path
        d="M9.94 4.5H8.62C7.14 4.5 6.13 5.29 6.13 6.63C6.13 7.68 6.64 8.32 7.61 8.99L6 12.42V12.5H7.24L9 8.72H9.94V12.5H11V4.5H9.94ZM9.94 7.82H9.16C8.28 7.82 7.42 7.42 7.42 6.63C7.42 5.85 8.09 5.5 8.9 5.5H9.94V7.82Z"
        fill="white"
      />
    </svg>
  )
}
