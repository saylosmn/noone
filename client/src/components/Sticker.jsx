// noone-ийн өөрийн стикерүүд — энгийн "бөөрөнхий" дүр, өөр өөр царайтай.
const INK = '#1b1530';

export const STICKERS = [
  { id: 'hi', label: 'Сайн уу', color: '#ffb347', eyes: 'happy', mouth: 'open', extras: ['wave'] },
  { id: 'haha', label: 'Хахаха', color: '#ffd23d', eyes: 'laugh', mouth: 'big', extras: ['joyTears'] },
  { id: 'love', label: 'Хайртай', color: '#ff6b9a', eyes: 'heart', mouth: 'smile', extras: ['blush'] },
  { id: 'sad', label: 'Уйлмаар', color: '#6aa2ff', eyes: 'sad', mouth: 'frown', extras: ['tear'] },
  { id: 'wow', label: 'Ёстой юу?', color: '#b388ff', eyes: 'big', mouth: 'o', extras: [] },
  { id: 'cool', label: 'Гоё', color: '#2dd4bf', eyes: 'shades', mouth: 'smirk', extras: ['sparkle'] },
  { id: 'sleepy', label: 'Унтмаар', color: '#a3b1c6', eyes: 'line', mouth: 'smallO', extras: ['zzz'] },
  { id: 'angry', label: 'Ууртай', color: '#ff5a4f', eyes: 'angry', mouth: 'grit', extras: ['steam'] },
  { id: 'think', label: 'Хмм…', color: '#fbbf24', eyes: 'think', mouth: 'flat', extras: ['question'] },
  { id: 'thanks', label: 'Баярлалаа', color: '#4ade80', eyes: 'happy', mouth: 'smile', extras: ['blush', 'hearts'] },
  { id: 'gg', label: 'GG', color: '#fb923c', eyes: 'star', mouth: 'open', extras: ['headset'] },
  { id: 'bye', label: 'Баяртай', color: '#60a5fa', eyes: 'wink', mouth: 'smile', extras: ['wave'] },
];

export const stickerLabel = (id) => STICKERS.find((s) => s.id === id)?.label ?? 'Стикер';

const stroke = { stroke: INK, strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };

function Eyes({ type }) {
  const dot = (cx) => (
    <g key={cx}>
      <circle cx={cx} cy="52" r="5.5" fill={INK} />
      <circle cx={cx + 1.8} cy="50" r="1.8" fill="#fff" />
    </g>
  );
  switch (type) {
    case 'happy':
      return (
        <>
          <path d="M37 54 Q44 45 51 54" {...stroke} />
          <path d="M69 54 Q76 45 83 54" {...stroke} />
        </>
      );
    case 'laugh':
      return (
        <>
          <path d="M37 46 L49 52 L37 58" {...stroke} />
          <path d="M83 46 L71 52 L83 58" {...stroke} />
        </>
      );
    case 'heart': {
      const heart = (x) => (
        <path
          key={x}
          d={`M${x} 58 C${x - 12} 50 ${x - 9} 41 ${x - 3} 43 C${x - 1} 43.5 ${x} 45 ${x} 46 C${x} 45 ${x + 1} 43.5 ${x + 3} 43 C${x + 9} 41 ${x + 12} 50 ${x} 58Z`}
          fill="#e11d48"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      );
      return (
        <>
          {heart(44)}
          {heart(76)}
        </>
      );
    }
    case 'sad':
      return (
        <>
          {dot(44)}
          {dot(76)}
          <path d="M35 44 L50 39" {...stroke} strokeWidth="3.5" />
          <path d="M85 44 L70 39" {...stroke} strokeWidth="3.5" />
        </>
      );
    case 'big':
      return (
        <>
          {[44, 76].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="50" r="10" fill="#fff" stroke={INK} strokeWidth="3" />
              <circle cx={cx} cy="51" r="5" fill={INK} />
              <circle cx={cx + 2} cy="49" r="1.6" fill="#fff" />
            </g>
          ))}
        </>
      );
    case 'shades':
      return (
        <>
          <path d="M30 46 H90" {...stroke} strokeWidth="3.5" />
          <path d="M32 46 h22 v6 a8 8 0 0 1 -8 8 h-6 a8 8 0 0 1 -8 -8z" fill={INK} />
          <path d="M66 46 h22 v6 a8 8 0 0 1 -8 8 h-6 a8 8 0 0 1 -8 -8z" fill={INK} />
          <path d="M37 50 l6 -3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M71 50 l6 -3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </>
      );
    case 'line':
      return (
        <>
          <path d="M37 54 Q44 58 51 54" {...stroke} />
          <path d="M69 54 Q76 58 83 54" {...stroke} />
        </>
      );
    case 'angry':
      return (
        <>
          {dot(44)}
          {dot(76)}
          <path d="M34 40 L51 47" {...stroke} strokeWidth="4.5" />
          <path d="M86 40 L69 47" {...stroke} strokeWidth="4.5" />
        </>
      );
    case 'think':
      return (
        <>
          {dot(44)}
          {dot(76)}
          <path d="M68 40 Q76 34 85 39" {...stroke} strokeWidth="3.5" />
          <path d="M37 44 L51 44" {...stroke} strokeWidth="3.5" />
        </>
      );
    case 'star': {
      const star = (cx) => (
        <path
          key={cx}
          d={`M${cx} 41 l3.2 6.6 7.2 1 -5.2 5 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.2 -5 7.2 -1z`}
          fill="#fff7a8"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      );
      return (
        <>
          {star(44)}
          {star(76)}
        </>
      );
    }
    case 'wink':
      return (
        <>
          {dot(44)}
          <path d="M69 54 Q76 45 83 54" {...stroke} />
        </>
      );
    default:
      return (
        <>
          {dot(44)}
          {dot(76)}
        </>
      );
  }
}

function Mouth({ type }) {
  switch (type) {
    case 'open':
      return (
        <>
          <path d="M45 67 Q60 88 75 67 Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M52 77 Q60 72 68 77 Q60 84 52 77Z" fill="#ff7a93" />
        </>
      );
    case 'big':
      return (
        <>
          <path d="M40 64 H80 Q80 92 60 92 Q40 92 40 64Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M48 83 Q60 76 72 83 Q60 92 48 83Z" fill="#ff7a93" />
          <path d="M44 65 H76 V69 H44Z" fill="#fff" />
        </>
      );
    case 'smile':
      return <path d="M46 68 Q60 81 74 68" {...stroke} />;
    case 'frown':
      return <path d="M47 78 Q60 67 73 78" {...stroke} />;
    case 'o':
      return <ellipse cx="60" cy="76" rx="7" ry="9" fill={INK} />;
    case 'smallO':
      return <ellipse cx="60" cy="74" rx="4" ry="5" fill={INK} />;
    case 'flat':
      return <path d="M50 74 L70 72" {...stroke} />;
    case 'smirk':
      return <path d="M48 73 Q62 80 75 67" {...stroke} />;
    case 'grit':
      return (
        <>
          <rect x="44" y="66" width="32" height="14" rx="5" fill="#fff" stroke={INK} strokeWidth="3" />
          <path d="M52 66 V80 M60 66 V80 M68 66 V80 M44 73 H76" stroke={INK} strokeWidth="2" />
        </>
      );
    default:
      return null;
  }
}

function Extra({ type }) {
  switch (type) {
    case 'wave':
      return (
        <g>
          <circle cx="104" cy="44" r="9" fill="#ffe0b8" stroke={INK} strokeWidth="3" />
          <path d="M112 28 q4 4 2 9 M117 34 q3 4 1 8" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'joyTears':
      return (
        <>
          <path d="M30 56 q-6 8 -2 12 q5 3 6 -3 z" fill="#5ec8ff" stroke={INK} strokeWidth="2" />
          <path d="M90 56 q6 8 2 12 q-5 3 -6 -3 z" fill="#5ec8ff" stroke={INK} strokeWidth="2" />
        </>
      );
    case 'tear':
      return <path d="M42 60 q-5 9 0 12 q5 -3 0 -12z" fill="#5ec8ff" stroke={INK} strokeWidth="2" />;
    case 'blush':
      return (
        <>
          <ellipse cx="32" cy="64" rx="7" ry="4" fill="#ff7a93" opacity="0.7" />
          <ellipse cx="88" cy="64" rx="7" ry="4" fill="#ff7a93" opacity="0.7" />
        </>
      );
    case 'hearts':
      return (
        <>
          <path d="M100 22 c-6 -5 -2 -10 1 -8 c3 -2 7 3 1 8z" fill="#e11d48" />
          <path d="M18 26 c-5 -4 -2 -8 1 -6 c2 -2 6 2 1 6z" fill="#e11d48" />
        </>
      );
    case 'sparkle':
      return (
        <path d="M100 18 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#fff" stroke={INK} strokeWidth="1.5" />
      );
    case 'zzz':
      return (
        <text x="88" y="26" fontFamily="Unbounded, Inter, sans-serif" fontWeight="700" fontSize="16" fill="#fff" stroke={INK} strokeWidth="1.2">
          z<tspan fontSize="12" dy="-6">z</tspan>
          <tspan fontSize="9" dy="-5">z</tspan>
        </text>
      );
    case 'steam':
      return (
        <>
          <path d="M22 22 q4 -6 0 -12 M30 18 q4 -6 0 -12" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M90 18 q4 -6 0 -12 M98 22 q4 -6 0 -12" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'question':
      return (
        <text x="92" y="32" fontFamily="Unbounded, Inter, sans-serif" fontWeight="700" fontSize="26" fill="#fff" stroke={INK} strokeWidth="1.5">
          ?
        </text>
      );
    case 'headset':
      return (
        <>
          <path d="M22 54 Q22 14 60 14 Q98 14 98 54" stroke={INK} strokeWidth="5" fill="none" />
          <rect x="14" y="46" width="12" height="20" rx="5" fill="#334155" stroke={INK} strokeWidth="3" />
          <rect x="94" y="46" width="12" height="20" rx="5" fill="#334155" stroke={INK} strokeWidth="3" />
          <path d="M20 66 Q24 84 42 84" stroke={INK} strokeWidth="3" fill="none" />
          <circle cx="44" cy="84" r="3.5" fill={INK} />
        </>
      );
    default:
      return null;
  }
}

export function Sticker({ id, size = 112 }) {
  const s = STICKERS.find((x) => x.id === id);
  if (!s) return null;
  const small = s.label.length > 7;
  return (
    <svg viewBox="0 0 120 124" width={size} height={size * (124 / 120)} role="img" aria-label={`Стикер: ${s.label}`} className="sticker-svg">
      <path
        d="M60 10 C90 10 108 30 108 58 C108 86 90 102 60 102 C30 102 12 86 12 58 C12 30 30 10 60 10Z"
        fill={s.color}
        stroke={INK}
        strokeWidth="4"
      />
      <ellipse cx="42" cy="26" rx="14" ry="7" fill="#fff" opacity="0.35" transform="rotate(-20 42 26)" />
      {s.extras.includes('headset') && <Extra type="headset" />}
      <Eyes type={s.eyes} />
      <Mouth type={s.mouth} />
      {s.extras.filter((e) => e !== 'headset').map((e) => (
        <Extra key={e} type={e} />
      ))}
      <g>
        <rect x="14" y="96" width="92" height="25" rx="12.5" fill={INK} />
        <text
          x="60"
          y="113.5"
          textAnchor="middle"
          fontFamily="Unbounded, Inter, sans-serif"
          fontWeight="700"
          fontSize={small ? 11 : 13}
          fill="#fff"
        >
          {s.label}
        </text>
      </g>
    </svg>
  );
}
