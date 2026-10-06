import type { ReactNode, CSSProperties } from 'react'

/*
  MangaGreen Premium, этап 1 — реестры рамок/фонов/связок (см. задачу E1-E7).
  Вся графика — своя (SVG/CSS), без узнаваемых персонажей/оружия/эмблем из
  чужих франшиз. Три НЕЗАВИСИМЫХ реестра (frame/background — по отдельности
  для "Своей сборки", bundle — готовый пресет всех троих + акцент разом),
  id везде совпадают с id бренд-темы (bundle), т.к. у каждой связки пока
  ровно одна "родная" рамка и один "родной" фон — когда художник пришлёт
  готовые работы, их подключают сюда добавлением записи в реестр, без
  переписывания компонентов, которые их используют (AvatarWithFrame,
  ProfileBackground).

  Общая система координат для рамок: viewBox 0 0 140 140, аватар — круг
  r=50 в центре (70,70). Декор рамки рисуется СНАРУЖИ этого круга (уши,
  шляпа, хвост, лапки) — общий масштаб контейнера см. FRAME_SCALE в
  AvatarWithFrame.tsx.
*/

export const PREMIUM_BUNDLE_IDS = [
  'sakura',
  'cosmos',
  'kitsune',
  'wanderer',
  'sunset',
  'mangagreen',
  'heaven',
  'flame',
  'cozy',
  'ball',
] as const
export type PremiumBundleId = (typeof PREMIUM_BUNDLE_IDS)[number]

export const PREMIUM_STICKERS = ['fire', 'sparkle', 'heart', 'cry', 'laugh', 'star', 'paw', 'book', 'heart_eyes', 'shock'] as const
export type PremiumSticker = (typeof PREMIUM_STICKERS)[number]

export const PREMIUM_ACCENT_COLORS: Record<PremiumBundleId, string> = {
  sakura: '#f472b6',
  cosmos: '#a78bfa',
  kitsune: '#fb923c',
  wanderer: '#ca8a04',
  sunset: '#b91c1c',
  mangagreen: '#4caf7d',
  heaven: '#38bdf8',
  flame: '#ef4444',
  cozy: '#f59e0b',
  ball: '#eab308',
}

export function isPremiumBundleId(v: unknown): v is PremiumBundleId {
  return typeof v === 'string' && (PREMIUM_BUNDLE_IDS as readonly string[]).includes(v)
}

interface ArtProps {
  /** false — статично (prefers-reduced-motion или мелкий размер), см. AvatarWithFrame. */
  animated: boolean
}

// --- Общие мелкие помощники для декоративных частиц (лепестки/звёзды/искры/капли) ---
function scatter(count: number, ring: (i: number) => { cx: number; cy: number }, render: (i: number, p: { cx: number; cy: number }) => ReactNode) {
  return Array.from({ length: count }, (_, i) => render(i, ring(i)))
}

// ============================== РАМКИ ==============================
// Каждая рисует только декор ВОКРУГ круга r=50 @ (70,70) — сам аватар
// накладывается поверх отдельным <image>/<div> в AvatarWithFrame.

function FrameSakura({ animated }: ArtProps) {
  // Венок из цветков сакуры по кольцу чуть за краем аватара.
  const petals = scatter(10, (i) => {
    const a = (i / 10) * Math.PI * 2
    return { cx: 70 + Math.cos(a) * 54, cy: 70 + Math.sin(a) * 54 }
  }, (i, p) => (
    <g key={i} transform={`translate(${p.cx} ${p.cy}) rotate(${(i * 137) % 360})`} className={animated ? 'pg-sway' : undefined} style={{ animationDelay: `${i * 0.3}s` }}>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} rx="4.2" ry="6.4" fill="#fbc9de" stroke="#f472b6" strokeWidth="0.6" transform={`rotate(${r}) translate(0 -5.5)`} />
      ))}
      <circle r="2.2" fill="#f472b6" />
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
  // Орбитальное кольцо с планеткой — половина проходит перед аватаром (см. spec).
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

function FrameSunset(_props: ArtProps) {
  // Скрещённые катаны под аватаром — свой дизайн клинков (не копия существующих).
  return (
    <g transform="translate(70 118)">
      {[-28, 28].map((dx, i) => (
        <g key={i} transform={`rotate(${dx})`}>
          <rect x="-2.2" y="-34" width="4.4" height="34" rx="1.6" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.6" />
          <rect x="-1" y="-34" width="1.4" height="30" fill="#f8fafc" opacity="0.8" />
          <rect x="-7" y="-2" width="14" height="4" rx="1.5" fill="#7c2d12" />
          <rect x="-3.4" y="2" width="6.8" height="9" rx="2" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="0.6" />
        </g>
      ))}
    </g>
  )
}

function FrameMangaGreen(_props: ArtProps) {
  // Лавровый венок — фирменный зелёный.
  const leaf = (side: 1 | -1) => (
    <g transform={`translate(70 70) scale(${side} 1)`}>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 6) * i - Math.PI / 2.15
        const r = 50
        const x = Math.cos(a) * r * 0.98
        const y = Math.sin(a) * r
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx="5.6"
            ry="3.1"
            fill="#4caf7d"
            stroke="#2b6f49"
            strokeWidth="0.5"
            transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`}
          />
        )
      })}
    </g>
  )
  return (
    <>
      {leaf(1)}
      {leaf(-1)}
      <circle cx="70" cy="16" r="2.4" fill="#6fc298" />
    </>
  )
}

function FrameHeaven(_props: ArtProps) {
  // Нимб сверху + маленькие крылышки по бокам. Статична (см. лимит "2-3 анимированных рамки").
  return (
    <>
      <ellipse cx="70" cy="16" rx="16" ry="5" fill="none" stroke="#facc15" strokeWidth="3" />
      <path d="M20 76 C6 70 4 54 12 46 C18 60 24 66 34 70 Z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" />
      <path d="M120 76 C134 70 136 54 128 46 C122 60 116 66 106 70 Z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" />
    </>
  )
}

function FrameFlame(_props: ArtProps) {
  // Рожки + хвостик чертёнка. Статична.
  return (
    <>
      <path d="M46 34 C44 18 58 14 58 28 C58 34 50 36 46 34 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
      <path d="M94 34 C96 18 82 14 82 28 C82 34 90 36 94 34 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
      <path d="M104 100 C122 104 122 122 108 122 C100 122 98 112 104 110" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M104 108 L110 106 L108 113 Z" fill="#ef4444" />
    </>
  )
}

function FrameCozy(_props: ArtProps) {
  // Хомяк снизу, лапками цепляется за край аватара. Статична.
  return (
    <g transform="translate(70 118)">
      <ellipse cx="0" cy="10" rx="20" ry="13" fill="#f3caa0" stroke="#b98552" strokeWidth="1" />
      <circle cx="-10" cy="1" r="6" fill="#f3caa0" stroke="#b98552" strokeWidth="1" />
      <circle cx="10" cy="1" r="6" fill="#f3caa0" stroke="#b98552" strokeWidth="1" />
      <circle cx="-2" cy="-2" r="1.2" fill="#3f2c1c" />
      <circle cx="4" cy="-2" r="1.2" fill="#3f2c1c" />
      <ellipse cx="1" cy="1" rx="2" ry="1.4" fill="#eab6a1" />
      <ellipse cx="-9" cy="-8" rx="3.4" ry="4.6" fill="#f3caa0" stroke="#b98552" strokeWidth="0.8" />
      <ellipse cx="9" cy="-8" rx="3.4" ry="4.6" fill="#f3caa0" stroke="#b98552" strokeWidth="0.8" />
    </g>
  )
}

function FrameBall(_props: ArtProps) {
  // Цилиндр с моноклем + бабочка снизу.
  return (
    <>
      <rect x="56" y="10" width="28" height="18" rx="2" fill="#1f2937" stroke="#000" strokeWidth="1" />
      <rect x="53" y="26" width="34" height="4" rx="1.5" fill="#111827" />
      <rect x="76" y="12" width="6" height="4" fill="#eab308" opacity="0.9" />
      <circle cx="94" cy="46" r="6" fill="none" stroke="#eab308" strokeWidth="2" />
      <line x1="99" y1="50" x2="103" y2="55" stroke="#eab308" strokeWidth="1.6" />
      <g transform="translate(70 122)">
        <path d="M0 0 L-12 -6 L-12 6 Z" fill="#111827" />
        <path d="M0 0 L12 -6 L12 6 Z" fill="#111827" />
        <circle r="2.6" fill="#eab308" />
      </g>
    </>
  )
}

export const FRAME_REGISTRY: Record<PremiumBundleId, (p: ArtProps) => ReactNode> = {
  sakura: FrameSakura,
  cosmos: FrameCosmos,
  kitsune: FrameKitsune,
  wanderer: FrameWanderer,
  sunset: FrameSunset,
  mangagreen: FrameMangaGreen,
  heaven: FrameHeaven,
  flame: FrameFlame,
  cozy: FrameCozy,
  ball: FrameBall,
}

// ============================== ФОНЫ ПРОФИЛЯ ==============================
// Заполняют весь баннер (viewBox 0 0 400 140, preserveAspectRatio slice) —
// см. ProfileBackground.tsx, там же полупрозрачная подложка поверх для
// читаемости текста в обеих темах.

function BgSakura({ animated }: ArtProps) {
  const petals = scatter(14, (i) => ({ cx: (i * 61) % 400, cy: -10 - (i % 5) * 22 }), (i, p) => (
    <ellipse key={i} cx={p.cx} cy={p.cy} rx="5" ry="7.5" fill="#f9a8d4" opacity="0.75" className={animated ? 'pg-fall' : undefined} style={{ animationDelay: `${i * 0.9}s`, animationDuration: `${9 + (i % 4)}s` }} />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-sakura-sky)" />
      {petals}
    </>
  )
}

function BgCosmos({ animated }: ArtProps) {
  const stars = scatter(24, (i) => ({ cx: (i * 37) % 400, cy: (i * 53) % 140 }), (i, p) => (
    <circle key={i} cx={p.cx} cy={p.cy} r={i % 3 === 0 ? 1.6 : 0.9} fill="#e9d5ff" className={animated ? 'pg-twinkle' : undefined} style={{ animationDelay: `${(i % 6) * 0.4}s` }} />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-cosmos-sky)" />
      {stars}
      {animated && <circle r="1.6" fill="#fff" className="pg-comet"><animateMotion dur="7s" repeatCount="indefinite" path="M-20,20 L420,110" /></circle>}
    </>
  )
}

function BgKitsune({ animated }: ArtProps) {
  const lanterns = scatter(5, (i) => ({ cx: 40 + i * 80, cy: 70 + (i % 2) * 14 }), (i, p) => (
    <g key={i} className={animated ? 'pg-sway' : undefined} style={{ transformOrigin: `${p.cx}px ${p.cy - 20}px`, animationDelay: `${i * 0.4}s` }}>
      <line x1={p.cx} y1={p.cy - 24} x2={p.cx} y2={p.cy - 12} stroke="#7c2d12" strokeWidth="1" />
      <ellipse cx={p.cx} cy={p.cy} rx="7" ry="9" fill="#fb923c" stroke="#c2410c" strokeWidth="1" />
      <ellipse cx={p.cx} cy={p.cy} rx="7" ry="9" fill="#fde68a" opacity="0.35" />
    </g>
  ))
  const fireflies = scatter(10, (i) => ({ cx: (i * 43) % 400, cy: 20 + (i * 29) % 90 }), (i, p) => (
    <circle key={i} cx={p.cx} cy={p.cy} r="1.3" fill="#fde68a" className={animated ? 'pg-twinkle' : undefined} style={{ animationDelay: `${(i % 5) * 0.5}s` }} />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-kitsune-sky)" />
      <path d="M0 120 Q100 100 200 118 T400 112 V140 H0 Z" fill="#1f2937" opacity="0.55" />
      {lanterns}
      {fireflies}
    </>
  )
}

function BgWanderer({ animated }: ArtProps) {
  const grass = scatter(30, (i) => ({ cx: (i * 13.4) % 400, cy: 118 + (i % 4) }), (i, p) => (
    <path key={i} d={`M${p.cx} 140 Q${p.cx + 3} ${p.cy} ${p.cx + 1} ${p.cy - 10}`} stroke="#a16207" strokeWidth="1.4" fill="none" className={animated ? 'pg-sway' : undefined} style={{ transformOrigin: `${p.cx}px 140px`, animationDelay: `${(i % 6) * 0.2}s` }} />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-wanderer-sky)" />
      <ellipse cx="120" cy="30" rx="140" ry="55" fill="#3f5b3a" opacity="0.5" />
      {/* Огромный оригинальный меч, воткнутый в холм — не копия существующих клинков. */}
      <g transform="translate(300 118) rotate(-14)">
        <rect x="-3" y="-90" width="6" height="90" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
        <rect x="-1" y="-88" width="2" height="80" fill="#f1f5f9" opacity="0.7" />
        <rect x="-11" y="-6" width="22" height="5" rx="2" fill="#78350f" />
        <rect x="-5" y="-2" width="10" height="12" rx="2" fill="#a16207" />
      </g>
      {grass}
    </>
  )
}

function BgSunset({ animated }: ArtProps) {
  const grass = scatter(26, (i) => ({ cx: (i * 15.4) % 400, cy: 130 }), (i, p) => (
    <path key={i} d={`M${p.cx} 140 Q${p.cx + 3} 122 ${p.cx} 112`} stroke="#7f1d1d" strokeWidth="1.6" fill="none" className={animated ? 'pg-sway' : undefined} style={{ transformOrigin: `${p.cx}px 140px`, animationDelay: `${(i % 5) * 0.25}s` }} />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-sunset-sky)" />
      <circle cx="320" cy="60" r="32" fill="#fca5a5" opacity="0.8" />
      {[[70, 118], [130, 122], [190, 116]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${-16 + i * 10})`}>
          <rect x="-1.6" y="-26" width="3.2" height="26" rx="1.2" fill="#e2e8f0" opacity="0.9" />
          <rect x="-5" y="-2" width="10" height="4" rx="1.5" fill="#7c2d12" />
        </g>
      ))}
      {grass}
    </>
  )
}

function BgMangaGreen({ animated }: ArtProps) {
  // Стена плывущих абстрактных карточек-раскадровки (без реальных обложек).
  const cards = scatter(9, (i) => ({ cx: 30 + (i % 5) * 82, cy: 26 + Math.floor(i / 5) * 78 }), (i, p) => (
    <rect
      key={i}
      x={p.cx}
      y={p.cy}
      width="46"
      height="60"
      rx="5"
      fill={`hsl(${140 + (i * 23) % 60} 35% ${22 + (i % 3) * 6}%)`}
      stroke="#2b6f49"
      strokeWidth="1"
      opacity="0.85"
      className={animated ? 'pg-float' : undefined}
      style={{ animationDelay: `${i * 0.5}s` }}
    />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-mangagreen-sky)" />
      {cards}
    </>
  )
}

function BgHeaven({ animated }: ArtProps) {
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-heaven-sky)" />
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={60 + i * 140} cy={30 + (i % 2) * 40} rx="46" ry="14" fill="#fff" opacity="0.55" className={animated ? 'pg-float' : undefined} style={{ animationDelay: `${i * 0.6}s` }} />
      ))}
      <g opacity="0.35">
        {[40, 140, 240, 340].map((x, i) => (
          <polygon key={i} points={`${x},-10 ${x + 26},150 ${x - 6},150`} fill="#fef9c3" />
        ))}
      </g>
    </>
  )
}

function BgFlame({ animated }: ArtProps) {
  const embers = scatter(16, (i) => ({ cx: (i * 27) % 400, cy: 120 - (i % 6) * 12 }), (i, p) => (
    <circle key={i} cx={p.cx} cy={p.cy} r={1 + (i % 3)} fill={i % 2 ? '#fb923c' : '#ef4444'} className={animated ? 'pg-rise' : undefined} style={{ animationDelay: `${i * 0.4}s`, animationDuration: `${5 + (i % 4)}s` }} />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-flame-sky)" />
      <path d="M0 140 Q60 90 140 120 T280 110 T400 130 V140 Z" fill="#450a0a" opacity="0.6" />
      {embers}
    </>
  )
}

function BgCozy({ animated }: ArtProps) {
  const rain = scatter(20, (i) => ({ cx: (i * 21) % 400, cy: (i * 17) % 140 }), (i, p) => (
    <line key={i} x1={p.cx} y1={p.cy} x2={p.cx - 4} y2={p.cy + 14} stroke="#93c5fd" strokeWidth="1.2" opacity="0.5" className={animated ? 'pg-rain' : undefined} style={{ animationDelay: `${(i % 8) * 0.2}s` }} />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-cozy-sky)" />
      <rect x="30" y="20" width="80" height="60" rx="4" fill="#78350f" opacity="0.5" />
      <rect x="38" y="28" width="64" height="44" rx="2" fill="#fcd34d" opacity="0.55" />
      {rain}
    </>
  )
}

function BgBall(_props: ArtProps) {
  const dust = scatter(18, (i) => ({ cx: (i * 23) % 400, cy: (i * 19) % 140 }), (i, p) => (
    <circle key={i} cx={p.cx} cy={p.cy} r="1" fill="#fde68a" opacity="0.7" />
  ))
  return (
    <>
      <rect width="400" height="140" fill="url(#pg-ball-sky)" />
      <g transform="translate(200 6)">
        <line x1="0" y1="0" x2="0" y2="14" stroke="#eab308" strokeWidth="1" />
        {[-36, -18, 0, 18, 36].map((dx, i) => (
          <line key={i} x1="0" y1="14" x2={dx} y2="40" stroke="#eab308" strokeWidth="1" opacity="0.8" />
        ))}
        <circle cy="14" r="4" fill="#fde68a" />
      </g>
      {dust}
    </>
  )
}

export const BACKGROUND_REGISTRY: Record<PremiumBundleId, (p: ArtProps) => ReactNode> = {
  sakura: BgSakura,
  cosmos: BgCosmos,
  kitsune: BgKitsune,
  wanderer: BgWanderer,
  sunset: BgSunset,
  mangagreen: BgMangaGreen,
  heaven: BgHeaven,
  flame: BgFlame,
  cozy: BgCozy,
  ball: BgBall,
}

/** Градиенты неба для фонов — общие <defs>, см. ProfileBackground.tsx. */
export const BACKGROUND_GRADIENTS: Record<PremiumBundleId, { id: string; stops: [string, string] }> = {
  sakura: { id: 'pg-sakura-sky', stops: ['#4a1942', '#7d3a63'] },
  cosmos: { id: 'pg-cosmos-sky', stops: ['#180a33', '#3b1466'] },
  kitsune: { id: 'pg-kitsune-sky', stops: ['#1b1130', '#4a2a1f'] },
  wanderer: { id: 'pg-wanderer-sky', stops: ['#87b6d9', '#cfe6b8'] },
  sunset: { id: 'pg-sunset-sky', stops: ['#5b1a1a', '#9a3412'] },
  mangagreen: { id: 'pg-mangagreen-sky', stops: ['#0d1f16', '#173a26'] },
  heaven: { id: 'pg-heaven-sky', stops: ['#8ec9ef', '#d9edfb'] },
  flame: { id: 'pg-flame-sky', stops: ['#200606', '#5c1414'] },
  cozy: { id: 'pg-cozy-sky', stops: ['#141a2e', '#26314f'] },
  ball: { id: 'pg-ball-sky', stops: ['#171008', '#3a2a10'] },
}

// ============================== СТИКЕРЫ (E5) ==============================
// Простые плоские SVG-анимации одним стилем — см. StickerIcon.tsx.

export const STICKER_ICON: Record<PremiumSticker, (p: { size: number }) => ReactNode> = {
  fire: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="pg-sticker-flicker">
      <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-1-2.5.8 3 4 3.5 4 7a6 6 0 0 1-12 0c0-5 3-6 3-9 0-1.5 1-3 3-4.5Z" fill="#fb923c" stroke="#c2410c" strokeWidth="0.6" />
    </svg>
  ),
  sparkle: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="pg-sticker-spin">
      <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="#fde047" stroke="#ca8a04" strokeWidth="0.5" />
    </svg>
  ),
  heart: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="pg-sticker-pulse">
      <path d="M12 20 C4 14 2 9 5 6 C7.5 3.6 11 4.5 12 8 C13 4.5 16.5 3.6 19 6 C22 9 20 14 12 20Z" fill="#f472b6" stroke="#be185d" strokeWidth="0.6" />
    </svg>
  ),
  cry: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
      <circle cx="8.5" cy="11" r="1.1" fill="#3f2c1c" />
      <circle cx="15.5" cy="11" r="1.1" fill="#3f2c1c" />
      <path d="M8 16 Q12 14 16 16" stroke="#3f2c1c" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M8.5 12.5 Q7 17 5.5 19" stroke="#38bdf8" strokeWidth="1.4" fill="none" strokeLinecap="round" className="pg-sticker-drop" />
      <path d="M15.5 12.5 Q17 17 18.5 19" stroke="#38bdf8" strokeWidth="1.4" fill="none" strokeLinecap="round" className="pg-sticker-drop" style={{ animationDelay: '0.3s' }} />
    </svg>
  ),
  laugh: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="pg-sticker-bounce">
      <circle cx="12" cy="12" r="9" fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
      <path d="M8 10 L10 8" stroke="#3f2c1c" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M16 10 L14 8" stroke="#3f2c1c" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 13 Q12 20 17 13 Z" fill="#7c2d12" />
      <path d="M9 13.5 Q12 16.5 15 13.5 Z" fill="#fff" />
    </svg>
  ),
  star: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="pg-sticker-twinkle">
      <path d="M12 2 L14.6 9 L22 9.5 L16.3 14 L18.2 21.3 L12 17.2 L5.8 21.3 L7.7 14 L2 9.5 L9.4 9 Z" fill="#facc15" stroke="#a16207" strokeWidth="0.6" />
    </svg>
  ),
  paw: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="pg-sticker-bounce">
      <ellipse cx="12" cy="16" rx="6" ry="5" fill="#a78bfa" stroke="#6d28d9" strokeWidth="0.6" />
      <circle cx="5.5" cy="9.5" r="2.4" fill="#a78bfa" stroke="#6d28d9" strokeWidth="0.6" />
      <circle cx="10.5" cy="6" r="2.4" fill="#a78bfa" stroke="#6d28d9" strokeWidth="0.6" />
      <circle cx="15.5" cy="6" r="2.4" fill="#a78bfa" stroke="#6d28d9" strokeWidth="0.6" />
      <circle cx="19" cy="9.5" r="2.4" fill="#a78bfa" stroke="#6d28d9" strokeWidth="0.6" />
    </svg>
  ),
  book: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M4 5 C7 3.5 10 3.5 12 5 V19 C10 17.5 7 17.5 4 19 Z" fill="#4caf7d" stroke="#2b6f49" strokeWidth="0.6" />
      <path d="M20 5 C17 3.5 14 3.5 12 5 V19 C14 17.5 17 17.5 20 19 Z" fill="#6fc298" stroke="#2b6f49" strokeWidth="0.6" className="pg-sticker-page" />
    </svg>
  ),
  heart_eyes: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="pg-sticker-pulse">
      <circle cx="12" cy="12" r="9" fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
      {[7.5, 16.5].map((cx, i) => (
        <path key={i} d={`M${cx} 12.5 C${cx - 2.4} 9.5 ${cx - 4.2} 11.5 ${cx} 14.5 C${cx + 4.2} 11.5 ${cx + 2.4} 9.5 ${cx} 12.5Z`} fill="#ef4444" />
      ))}
      <path d="M8.5 17 Q12 19.5 15.5 17" stroke="#3f2c1c" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  ),
  shock: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className="pg-sticker-bounce">
      <circle cx="12" cy="12" r="9" fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
      <circle cx="8.5" cy="10.5" r="1.6" fill="#3f2c1c" />
      <circle cx="15.5" cy="10.5" r="1.6" fill="#3f2c1c" />
      <ellipse cx="12" cy="16" rx="2.6" ry="3.4" fill="#3f2c1c" />
    </svg>
  ),
}

/** Инлайновый CSS для всех анимаций рамок/фонов/стикеров — один <style>, подключается один раз в AvatarWithFrame/ProfileBackground. prefers-reduced-motion сам глушит их глобально (см. использование className, animated=false выключает классы программно). */
export const PREMIUM_ANIMATIONS_CSS = `
@keyframes pg-sway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
@keyframes pg-twinkle { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
@keyframes pg-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes pg-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 0; } 10% { opacity: 0.75; } 100% { transform: translateY(160px) rotate(200deg); opacity: 0; } }
@keyframes pg-rise { 0% { transform: translateY(0); opacity: 0.9; } 100% { transform: translateY(-60px); opacity: 0; } }
@keyframes pg-rain { 0% { transform: translateY(0); opacity: 0.6; } 100% { transform: translateY(18px); opacity: 0; } }
@keyframes pg-orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.pg-sway { animation: pg-sway 3.2s ease-in-out infinite; }
.pg-twinkle { animation: pg-twinkle 2.4s ease-in-out infinite; }
.pg-float { animation: pg-float 4s ease-in-out infinite; }
.pg-fall { animation: pg-fall linear infinite; }
.pg-rise { animation: pg-rise ease-in infinite; }
.pg-rain { animation: pg-rain 1.1s linear infinite; }
.pg-orbit { animation: pg-orbit 14s linear infinite; }
.pg-sticker-flicker { animation: pg-sway 1.1s ease-in-out infinite; transform-origin: 50% 90%; }
.pg-sticker-spin { animation: pg-orbit 3s linear infinite; transform-origin: 50% 50%; }
.pg-sticker-pulse { animation: pg-scale 0.9s ease-in-out infinite; transform-origin: 50% 55%; }
.pg-sticker-bounce { animation: pg-float 0.9s ease-in-out infinite; }
.pg-sticker-twinkle { animation: pg-twinkle 1s ease-in-out infinite; }
.pg-sticker-drop { animation: pg-rain 1.3s ease-in infinite; transform-origin: 50% 0%; }
.pg-sticker-page { animation: pg-page 1.6s ease-in-out infinite; transform-origin: 12px 12px; }
@keyframes pg-scale { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
@keyframes pg-page { 0%,100% { transform: rotateY(0deg); } 50% { transform: rotateY(35deg); } }
@media (prefers-reduced-motion: reduce) {
  .pg-sway, .pg-twinkle, .pg-float, .pg-fall, .pg-rise, .pg-rain, .pg-orbit,
  .pg-sticker-flicker, .pg-sticker-spin, .pg-sticker-pulse, .pg-sticker-bounce, .pg-sticker-twinkle, .pg-sticker-drop, .pg-sticker-page {
    animation: none !important;
  }
}
` as const

export type { CSSProperties }
