import type { ReactNode, CSSProperties } from 'react'

/*
  MangaGreen Premium, этап 1 — реестр рамок аватара (см. задачу E1-E7).
  Вся графика — своя (SVG), без узнаваемых персонажей/оружия/эмблем из
  чужих франшиз. id рамки — и есть id пресета акцентного цвета (см.
  PREMIUM_ACCENT_COLORS): на этом этапе у каждой рамки ровно один "родной"
  цвет, отдельного реестра для него не нужно.

  Общая система координат для рамок: viewBox 0 0 140 140, аватар — круг
  r=50 в центре (70,70). Декор рамки рисуется СНАРУЖИ этого круга (уши,
  шляпа, хвост, лапки) — общий масштаб контейнера см. FRAME_SCALE в
  AvatarWithFrame.tsx.
*/

export const PREMIUM_FRAME_IDS = ['sakura', 'cosmos', 'kitsune', 'wanderer'] as const
export type PremiumFrameId = (typeof PREMIUM_FRAME_IDS)[number]

export const PREMIUM_ACCENT_COLORS: Record<PremiumFrameId, string> = {
  sakura: '#f472b6',
  cosmos: '#a78bfa',
  kitsune: '#fb923c',
  wanderer: '#ca8a04',
}

export function isPremiumFrameId(v: unknown): v is PremiumFrameId {
  return typeof v === 'string' && (PREMIUM_FRAME_IDS as readonly string[]).includes(v)
}

interface ArtProps {
  /** false — статично (prefers-reduced-motion или мелкий размер), см. AvatarWithFrame. */
  animated: boolean
}

// --- Общий мелкий помощник для декоративных частиц (лепестки/звёзды) ---
function scatter(count: number, ring: (i: number) => { cx: number; cy: number }, render: (i: number, p: { cx: number; cy: number }) => ReactNode) {
  return Array.from({ length: count }, (_, i) => render(i, ring(i)))
}

// ============================== РАМКИ ==============================
// Каждая рисует только декор ВОКРУГ круга r=50 @ (70,70) — сам аватар
// накладывается поверх отдельным <img> в AvatarWithFrame.

function FrameSakura({ animated }: ArtProps) {
  // Венок из цветков сакуры по кольцу чуть за краем аватара.
  const petals = scatter(10, (i) => {
    const a = (i / 10) * Math.PI * 2
    return { cx: 70 + Math.cos(a) * 54, cy: 70 + Math.sin(a) * 54 }
  }, (i, p) => (
    // Внешняя <g> — только позиция (SVG-атрибут transform), внутренняя — только
    // анимация (CSS transform). Нельзя вешать pg-sway на ту же <g>, что несёт
    // translate(): CSS-анимация transform ПЕРЕКРЫВАЕТ SVG-атрибут transform, и
    // все лепестки схлопываются в левый верхний угол (0,0) viewBox.
    <g key={i} transform={`translate(${p.cx} ${p.cy}) rotate(${(i * 137) % 360})`}>
      <g className={animated ? 'pg-sway' : undefined} style={{ animationDelay: `${i * 0.3}s` }}>
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} rx="4.2" ry="6.4" fill="#fbc9de" stroke="#f472b6" strokeWidth="0.6" transform={`rotate(${r}) translate(0 -5.5)`} />
        ))}
        <circle r="2.2" fill="#f472b6" />
      </g>
    </g>
  ))
  return (
    <>
      <circle cx="70" cy="70" r="52" fill="none" stroke="#f9a8d4" strokeWidth="1.5" opacity="0.5" />
      {petals}
    </>
  )
}

function FrameCosmos({ animated }: ArtProps) {
  // Орбитальное кольцо с планеткой — половина проходит перед аватаром (strokeDasharray поверх).
  return (
    <>
      <ellipse cx="70" cy="70" rx="62" ry="20" fill="none" stroke="#a78bfa" strokeWidth="2.5" opacity="0.55" transform="rotate(-18 70 70)" />
      <g className={animated ? 'pg-orbit' : undefined} style={{ transformOrigin: '70px 70px' }}>
        <circle cx="126" cy="58" r="6.5" fill="#c4b5fd" stroke="#7c3aed" strokeWidth="1" />
        <circle cx="124" cy="56" r="1.4" fill="#fff" opacity="0.8" />
      </g>
      <ellipse cx="70" cy="70" rx="62" ry="20" fill="none" stroke="#a78bfa" strokeWidth="2.5" opacity="0.95" transform="rotate(-18 70 70)" strokeDasharray="98 100" />
      {[[18, 20], [122, 16], [12, 100], [128, 108]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 2 ? 1 : 1.6} fill="#e9d5ff" className={animated ? 'pg-twinkle' : undefined} style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
    </>
  )
}

function FrameKitsune({ animated }: ArtProps) {
  // Лисьи ушки сверху + хвост сбоку-снизу.
  return (
    <>
      <path d="M40 34 L52 10 L60 38 Z" fill="#fb923c" stroke="#c2410c" strokeWidth="1.2" />
      <path d="M45 32 L53 18 L57 34 Z" fill="#fff7ed" />
      <path d="M100 34 L88 10 L80 38 Z" fill="#fb923c" stroke="#c2410c" strokeWidth="1.2" />
      <path d="M95 32 L87 18 L83 34 Z" fill="#fff7ed" />
      <path
        d="M108 96 C126 98 132 118 118 128 C108 135 94 130 96 118 C97 111 104 110 106 116"
        fill="#fb923c"
        stroke="#c2410c"
        strokeWidth="1.2"
        className={animated ? 'pg-sway' : undefined}
        style={{ transformOrigin: '108px 96px' }}
      />
      <circle cx="119" cy="122" r="5" fill="#fff7ed" />
    </>
  )
}

function FrameWanderer(_props: ArtProps) {
  // Соломенная шляпа (синяя лента, без эмблем) поверх, слегка сдвинута. Статична (см. лимит "2-3 анимированных рамки" — тут Sakura/Cosmos/Kitsune).
  return (
    <>
      <ellipse cx="70" cy="30" rx="40" ry="9" fill="#e6c265" stroke="#a9832f" strokeWidth="1.4" />
      <path d="M48 28 C48 12 92 12 92 28 C92 34 48 34 48 28 Z" fill="#f2d484" stroke="#a9832f" strokeWidth="1.4" />
      <rect x="49" y="25" width="42" height="5" fill="#2563eb" opacity="0.85" />
    </>
  )
}

export const FRAME_REGISTRY: Record<PremiumFrameId, (p: ArtProps) => ReactNode> = {
  sakura: FrameSakura,
  cosmos: FrameCosmos,
  kitsune: FrameKitsune,
  wanderer: FrameWanderer,
}

/** Инлайновый CSS для анимаций рамок — один <style>, подключается один раз в AvatarWithFrame (см. usePremiumStyles). prefers-reduced-motion сам глушит их глобально, плюс AvatarWithFrame не ставит className вовсе, когда reducedMotion. */
export const PREMIUM_ANIMATIONS_CSS = `
@keyframes pg-sway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
@keyframes pg-twinkle { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
@keyframes pg-orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.pg-sway { animation: pg-sway 3.2s ease-in-out infinite; }
.pg-twinkle { animation: pg-twinkle 2.4s ease-in-out infinite; }
.pg-orbit { animation: pg-orbit 14s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .pg-sway, .pg-twinkle, .pg-orbit {
    animation: none !important;
  }
}
` as const

export type { CSSProperties }
