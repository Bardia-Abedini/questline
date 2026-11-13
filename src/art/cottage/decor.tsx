import { HIGHLIGHT_OPACITY, INK, inkRoom, PALETTE } from '../style';

/**
 * Room decorations. Each draws in its slot's local box (see slots.ts for sizes); floor
 * items stand on the bottom edge. Names say slot first: `Bunting…`, `WallLeft…`, ...
 */

const shine = {
  fill: 'none',
  stroke: '#fff',
  strokeOpacity: HIGHLIGHT_OPACITY,
  strokeWidth: 2.5,
  strokeLinecap: 'round',
} as const;

/* ------------------------------------------------------------ bunting 312 x 30 */

const sag = (t: number) => 4 + 36 * t * (1 - t);

/** Cloth pennants on a string. Starter. */
export function BuntingPennants() {
  const colors = [PALETTE.berry, PALETTE.honey, PALETTE.sage, PALETTE.sky, PALETTE.lilac];
  const flags = Array.from({ length: 11 }, (_, i) => {
    const t = (i + 0.5) / 11;
    return { x: 2 + 308 * t, y: sag(t), color: colors[i % colors.length]! };
  });
  return (
    <g>
      <path d="M2 4 Q156 40 310 4" fill="none" stroke={PALETTE.bark} strokeWidth="1.5" />
      {flags.map((f, i) => (
        <path
          key={i}
          d={`M${f.x - 9} ${f.y - 1} L${f.x + 9} ${f.y - 1} L${f.x} ${f.y + 16} Z`}
          fill={f.color}
          {...inkRoom}
        />
      ))}
    </g>
  );
}

/** A string of warm little lights that glow softly in the evening. */
export function BuntingFairyLights() {
  const colors = [PALETTE.honey, PALETTE.rose, PALETTE.sage, PALETTE.sky];
  const bulbs = Array.from({ length: 14 }, (_, i) => {
    const t = (i + 0.5) / 14;
    return { x: 2 + 308 * t, y: sag(t), color: colors[i % colors.length]! };
  });
  return (
    <g>
      <path d="M2 4 Q156 40 310 4" fill="none" stroke={PALETTE.leafShade} strokeWidth="1.5" />
      {bulbs.map((b, i) => (
        <g key={i}>
          <circle
            className="qa-night qa-glow qa-flicker"
            cx={b.x}
            cy={b.y + 6}
            r="7"
            fill={b.color}
            opacity="0.35"
          />
          <rect x={b.x - 2} y={b.y - 1} width="4" height="4" rx="1" fill={PALETTE.slate} />
          <ellipse
            cx={b.x}
            cy={b.y + 6}
            rx="3.4"
            ry="4.2"
            fill={b.color}
            {...inkRoom}
            strokeWidth="1"
          />
        </g>
      ))}
    </g>
  );
}

/* ---------------------------------------------------------- wall_left 64 x 56 */

/** A framed painting of rolling hills. Starter. */
export function WallLeftLandscape() {
  return (
    <g>
      <path d="M18 8 L32 -2 L46 8" fill="none" stroke={INK} strokeWidth="1.2" />
      <circle cx="32" cy="-2" r="1.6" fill={INK} />
      <rect x="4" y="6" width="56" height="46" rx="4" fill={PALETTE.woodLight} {...inkRoom} />
      <rect
        x="10"
        y="12"
        width="44"
        height="34"
        rx="2"
        fill="#cfe8f3"
        {...inkRoom}
        strokeWidth="1"
      />
      <circle cx="44" cy="20" r="4" fill={PALETTE.honey} />
      <path d="M10 38 Q22 26 34 36 Q44 28 54 34 L54 46 L10 46 Z" fill={PALETTE.moss} />
      <path d="M10 42 Q26 34 40 42 Q48 38 54 41 L54 46 L10 46 Z" fill={PALETTE.mossShade} />
      <path d="M8 14 L8 26" {...shine} />
    </g>
  );
}

/** A round mirror in a honey frame. */
export function WallLeftMirror() {
  return (
    <g>
      <path d="M22 6 L32 -2 L42 6" fill="none" stroke={INK} strokeWidth="1.2" />
      <circle cx="32" cy="-2" r="1.6" fill={INK} />
      <circle cx="32" cy="29" r="25" fill={PALETTE.honey} {...inkRoom} />
      <circle cx="32" cy="29" r="19" fill="#dcedf2" {...inkRoom} strokeWidth="1" />
      <path
        d="M22 22 L30 14 M24 30 L38 16"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <g fill={PALETTE.honeyShade}>
        <circle cx="32" cy="5.5" r="2" />
        <circle cx="32" cy="52.5" r="2" />
        <circle cx="8.5" cy="29" r="2" />
        <circle cx="55.5" cy="29" r="2" />
      </g>
    </g>
  );
}

/* --------------------------------------------------------- wall_right 66 x 60 */

/** A little shelf with jam jars and a trailing plant. Starter. */
export function WallRightShelf() {
  return (
    <g>
      <path d="M12 44 L12 54 L20 44" fill={PALETTE.woodShade} {...inkRoom} strokeWidth="1.2" />
      <path d="M54 44 L54 54 L46 44" fill={PALETTE.woodShade} {...inkRoom} strokeWidth="1.2" />
      <rect x="2" y="38" width="62" height="7" rx="2.5" fill={PALETTE.wood} {...inkRoom} />
      {/* jam jar */}
      <rect x="6" y="20" width="15" height="18" rx="4" fill={PALETTE.berry} {...inkRoom} />
      <rect x="5" y="16" width="17" height="6" rx="2" fill={PALETTE.cream} {...inkRoom} />
      <rect x="9" y="26" width="9" height="6" rx="1.5" fill={PALETTE.cream} />
      {/* honey jar */}
      <rect x="25" y="24" width="13" height="14" rx="4" fill={PALETTE.honey} {...inkRoom} />
      <rect x="24" y="20" width="15" height="5" rx="2" fill={PALETTE.wood} {...inkRoom} />
      {/* trailing plant */}
      <path d="M43 38 L42 28 L58 28 L57 38 Z" fill={PALETTE.rust} {...inkRoom} />
      <path
        d="M47 28 C44 36 46 46 44 56 M53 28 C56 38 55 44 58 52"
        fill="none"
        stroke={PALETTE.leafShade}
        strokeWidth="1.5"
      />
      <g fill={PALETTE.leaf} {...inkRoom} strokeWidth="1">
        <ellipse cx="46" cy="22" rx="5" ry="7" transform="rotate(-20 46 22)" />
        <ellipse cx="54" cy="21" rx="5" ry="7" transform="rotate(20 54 21)" />
        <ellipse cx="44" cy="48" rx="2.6" ry="3.6" />
        <ellipse cx="45" cy="56" rx="2.6" ry="3.6" />
        <ellipse cx="57" cy="47" rx="2.6" ry="3.6" />
      </g>
    </g>
  );
}

/** A sunny wall clock. */
export function WallRightClock() {
  return (
    <g>
      <g fill={PALETTE.honey} {...inkRoom} strokeWidth="1.2">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          const x = 33 + Math.cos(a) * 25;
          const y = 30 + Math.sin(a) * 25;
          const x1 = 33 + Math.cos(a - 0.22) * 19;
          const y1 = 30 + Math.sin(a - 0.22) * 19;
          const x2 = 33 + Math.cos(a + 0.22) * 19;
          const y2 = 30 + Math.sin(a + 0.22) * 19;
          return <path key={i} d={`M${x1} ${y1} L${x} ${y} L${x2} ${y2} Z`} />;
        })}
      </g>
      <circle cx="33" cy="30" r="19" fill={PALETTE.cream} {...inkRoom} />
      <g fill={PALETTE.oatShade}>
        <circle cx="33" cy="15" r="1.5" />
        <circle cx="48" cy="30" r="1.5" />
        <circle cx="33" cy="45" r="1.5" />
        <circle cx="18" cy="30" r="1.5" />
      </g>
      <path d="M33 30 L33 19 M33 30 L41 34" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="33" cy="30" r="2" fill={PALETTE.rust} />
    </g>
  );
}

/* ----------------------------------------------------- window sill 68 x 28 */

/** A potted herb on the sill. Starter. */
export function WindowPlant() {
  return (
    <g>
      <g fill={PALETTE.leaf} {...inkRoom} strokeWidth="1.2">
        <ellipse cx="26" cy="4" rx="5" ry="10" transform="rotate(-30 26 4)" />
        <ellipse cx="42" cy="4" rx="5" ry="10" transform="rotate(30 42 4)" />
        <ellipse cx="34" cy="-2" rx="5" ry="11" />
      </g>
      <path d="M34 9 L34 14" stroke={PALETTE.leafShade} strokeWidth="2" />
      <path d="M23 28 L21 13 L47 13 L45 28 Z" fill={PALETTE.rust} {...inkRoom} />
      <rect x="19" y="11" width="30" height="6" rx="2" fill={PALETTE.rustShade} {...inkRoom} />
    </g>
  );
}

/** Three candles on a little dish, flickering. */
export function WindowCandles() {
  const candles = [
    { x: 16, h: 14 },
    { x: 34, h: 22 },
    { x: 52, h: 10 },
  ];
  return (
    <g>
      {candles.map((c) => (
        <g key={c.x}>
          <circle
            className="qa-night qa-glow qa-flicker"
            cx={c.x}
            cy={24 - c.h - 6}
            r="9"
            fill={PALETTE.honey}
            opacity="0.35"
          />
          <rect
            x={c.x - 5}
            y={24 - c.h}
            width="10"
            height={c.h}
            rx="2"
            fill={PALETTE.cream}
            {...inkRoom}
          />
          <path
            className="qa-flicker"
            d={`M${c.x} ${24 - c.h - 11} C${c.x + 4} ${24 - c.h - 6} ${c.x + 3} ${24 - c.h - 2} ${c.x} ${24 - c.h - 2} C${c.x - 3} ${24 - c.h - 2} ${c.x - 4} ${24 - c.h - 6} ${c.x} ${24 - c.h - 11} Z`}
            fill={PALETTE.honey}
            stroke={PALETTE.rust}
            strokeWidth="1"
          />
        </g>
      ))}
      <ellipse cx="34" cy="25" rx="31" ry="3.5" fill={PALETTE.stone} {...inkRoom} />
    </g>
  );
}

/* ---------------------------------------------------------------- lamp 36 x 62 */

/** A hanging brass lantern. Starter. */
export function LampLantern() {
  return (
    <g>
      <path d="M18 0 L18 18" stroke={INK} strokeWidth="1.5" />
      <circle cx="18" cy="16" r="3" fill="none" stroke={INK} strokeWidth="1.5" />
      <circle
        className="qa-night qa-glow qa-flicker"
        cx="18"
        cy="38"
        r="20"
        fill={PALETTE.honey}
        opacity="0.3"
      />
      <path d="M8 26 L12 19 L24 19 L28 26 Z" fill={PALETTE.honeyShade} {...inkRoom} />
      <rect x="9" y="26" width="18" height="22" rx="3" fill="#fde8a8" {...inkRoom} />
      <path
        className="qa-flicker"
        d="M18 30 C22 35 21 41 18 42 C15 41 14 35 18 30 Z"
        fill={PALETTE.honey}
      />
      <path d="M18 26 L18 48 M9 37 L27 37" stroke={PALETTE.honeyShade} strokeWidth="1.2" />
      <path d="M7 48 L29 48 L26 54 L10 54 Z" fill={PALETTE.honeyShade} {...inkRoom} />
    </g>
  );
}

/** A round paper globe lamp. */
export function LampPaperGlobe() {
  return (
    <g>
      <path d="M18 0 L18 22" stroke={INK} strokeWidth="1.5" />
      <circle
        className="qa-night qa-glow qa-flicker"
        cx="18"
        cy="40"
        r="22"
        fill={PALETTE.honey}
        opacity="0.28"
      />
      <rect x="13" y="20" width="10" height="5" rx="1.5" fill={PALETTE.slate} />
      <circle cx="18" cy="40" r="16" fill="#fff6e3" {...inkRoom} />
      <path
        d="M4 34 Q18 38 32 34 M3 42 Q18 46 33 42 M6 50 Q18 53 30 50"
        fill="none"
        stroke={PALETTE.oatShade}
        strokeWidth="1"
      />
      <path d="M10 30 Q13 27 17 26" {...shine} stroke={PALETTE.honey} strokeOpacity="0.6" />
    </g>
  );
}

/* -------------------------------------------------------------- corner 44 x 94 */

/** A tall leafy plant in a clay pot. Starter. */
export function CornerPlant() {
  return (
    <g>
      <path
        d="M22 70 C20 50 14 40 10 28 M22 70 C24 48 30 36 34 22 M22 70 C22 52 22 40 22 14"
        fill="none"
        stroke={PALETTE.leafShade}
        strokeWidth="2"
      />
      <g fill={PALETTE.leaf} {...inkRoom}>
        <path d="M10 28 C0 24 0 10 8 6 C14 12 16 22 10 28 Z" />
        <path d="M34 22 C44 18 46 4 38 0 C32 6 30 16 34 22 Z" />
        <path d="M22 14 C14 10 14 -2 22 -6 C30 -2 30 10 22 14 Z" />
        <path d="M14 46 C4 46 0 36 4 30 C12 32 16 40 14 46 Z" />
        <path d="M30 44 C40 44 44 34 40 28 C32 30 28 38 30 44 Z" />
      </g>
      <path
        d="M8 6 C8 14 9 22 10 28 M22 -6 L22 14"
        fill="none"
        stroke={PALETTE.leafShade}
        strokeWidth="1"
      />
      <path d="M9 94 L6 68 L38 68 L35 94 Z" fill={PALETTE.rust} {...inkRoom} />
      <rect x="4" y="64" width="36" height="8" rx="3" fill={PALETTE.rustShade} {...inkRoom} />
      <path d="M11 76 L12 88" {...shine} />
    </g>
  );
}

/** A floor lamp with a fringed shade. */
export function CornerFloorLamp() {
  return (
    <g>
      <circle
        className="qa-night qa-glow qa-flicker"
        cx="22"
        cy="20"
        r="26"
        fill={PALETTE.honey}
        opacity="0.28"
      />
      <path d="M22 30 L22 90" stroke={PALETTE.bark} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="22" cy="91" rx="13" ry="3.5" fill={PALETTE.bark} {...inkRoom} />
      <path d="M8 30 L14 6 L30 6 L36 30 Z" fill={PALETTE.rose} {...inkRoom} />
      <path d="M8 30 L36 30" stroke={PALETTE.roseShade} strokeWidth="3" strokeDasharray="2 2" />
      <path d="M16 10 L13 24" {...shine} />
    </g>
  );
}

/* --------------------------------------------------------------- table 92 x 88 */

/** A round side table with a teapot and a cup. Starter. */
export function TableTea() {
  return (
    <g>
      <path
        d="M22 50 L18 88 M70 50 L74 88 M46 52 L46 86"
        stroke={PALETTE.woodShade}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse cx="46" cy="48" rx="40" ry="8" fill={PALETTE.wood} {...inkRoom} />
      <path d="M12 46 Q46 52 80 46" fill="none" stroke={PALETTE.woodLight} strokeWidth="1.5" />
      {/* teapot */}
      <path
        d="M22 28 C14 30 14 38 20 40"
        fill="none"
        stroke={PALETTE.sky}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M48 32 C54 30 56 24 58 22"
        fill="none"
        stroke={INK}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M48 32 C54 30 56 24 58 22"
        fill="none"
        stroke={PALETTE.sky}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M20 44 C18 28 24 22 34 22 C44 22 50 28 48 44 Z" fill={PALETTE.sky} {...inkRoom} />
      <path d="M26 22 Q34 15 42 22 Z" fill={PALETTE.skyShade} {...inkRoom} />
      <circle cx="34" cy="16" r="2.5" fill={PALETTE.honey} {...inkRoom} strokeWidth="1" />
      <circle cx="34" cy="33" r="4" fill={PALETTE.snow} opacity="0.7" />
      <path d="M24 30 Q25 26 28 25" {...shine} />
      {/* cup */}
      <path d="M60 36 L62 45 L72 45 L74 36 Z" fill={PALETTE.cream} {...inkRoom} />
      <path d="M74 38 C78 38 78 43 73 43" fill="none" stroke={INK} strokeWidth="1.5" />
      <path
        d="M64 30 Q62 26 65 23 M70 30 Q68 26 71 23"
        fill="none"
        stroke={PALETTE.stone}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A small bookcase full of colorful books. */
export function TableBookcase() {
  const shelves = [10, 34, 58];
  const spines = [
    PALETTE.berry,
    PALETTE.sky,
    PALETTE.honey,
    PALETTE.moss,
    PALETTE.lilac,
    PALETTE.rust,
  ];
  return (
    <g>
      <rect x="12" y="2" width="68" height="84" rx="4" fill={PALETTE.wood} {...inkRoom} />
      <rect x="18" y="8" width="56" height="72" rx="2" fill={PALETTE.woodShade} />
      {shelves.map((y, s) => (
        <g key={y}>
          {Array.from({ length: 6 - s }, (_, i) => {
            const h = 18 - ((i + s) % 3) * 3;
            return (
              <rect
                key={i}
                x={20 + i * 8.6}
                y={y + 22 - h}
                width="7.4"
                height={h}
                rx="1.5"
                fill={spines[(i + s * 2) % spines.length]}
                {...inkRoom}
                strokeWidth="1"
              />
            );
          })}
          <rect
            x="16"
            y={y + 22}
            width="60"
            height="3.5"
            fill={PALETTE.wood}
            {...inkRoom}
            strokeWidth="1"
          />
        </g>
      ))}
      <rect x="16" y="84" width="8" height="4" fill={PALETTE.woodShade} />
      <rect x="68" y="84" width="8" height="4" fill={PALETTE.woodShade} />
    </g>
  );
}

/* ---------------------------------------------------------------- seat 100 x 86 */

/** A plump armchair with a patched cushion. Starter. */
export function SeatArmchair() {
  return (
    <g>
      <path
        d="M18 80 L16 86 M82 80 L84 86"
        stroke={PALETTE.bark}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M16 56 C14 20 22 8 50 8 C78 8 86 20 84 56 Z" fill={PALETTE.rust} {...inkRoom} />
      <path d="M30 16 Q40 12 50 12" {...shine} />
      <rect x="10" y="50" width="80" height="26" rx="10" fill={PALETTE.rustShade} {...inkRoom} />
      <rect x="2" y="38" width="22" height="42" rx="11" fill={PALETTE.rust} {...inkRoom} />
      <rect x="76" y="38" width="22" height="42" rx="11" fill={PALETTE.rust} {...inkRoom} />
      <rect x="34" y="24" width="32" height="26" rx="8" fill={PALETTE.honey} {...inkRoom} />
      <path
        d="M38 28 L62 46 M62 28 L38 46"
        stroke={PALETTE.honeyShade}
        strokeWidth="1.2"
        strokeDasharray="2.5 2.5"
      />
    </g>
  );
}

/** A squishy beanbag. */
export function SeatBeanbag() {
  return (
    <g>
      <path
        d="M14 84 C2 80 4 58 18 48 C24 30 40 22 56 26 C74 30 92 46 94 66 C96 80 86 86 70 86 Z"
        fill={PALETTE.plum}
        {...inkRoom}
      />
      <path
        d="M30 56 C40 64 58 66 72 60"
        fill="none"
        stroke={PALETTE.plumShade}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M28 40 Q40 30 54 31" {...shine} />
      <path d="M50 26 L54 33 L58 26" fill="none" stroke={PALETTE.plumShade} strokeWidth="1.5" />
    </g>
  );
}

/* ----------------------------------------------------------------- rug 152 x 38 */

/** A round braided rug. Starter. */
export function RugRound() {
  return (
    <g>
      <ellipse cx="76" cy="19" rx="74" ry="17" fill={PALETTE.rose} {...inkRoom} />
      <ellipse cx="76" cy="19" rx="60" ry="13" fill={PALETTE.oat} />
      <ellipse cx="76" cy="19" rx="46" ry="9.5" fill={PALETTE.sage} />
      <ellipse cx="76" cy="19" rx="30" ry="6" fill={PALETTE.cream} />
      <ellipse
        cx="76"
        cy="19"
        rx="67"
        ry="15"
        fill="none"
        stroke={PALETTE.roseShade}
        strokeWidth="1"
        strokeDasharray="3 3"
      />
    </g>
  );
}

/** A long striped rug with a fringe. */
export function RugStriped() {
  return (
    <g>
      <path
        d="M10 6 L6 2 M10 13 L5 13 M10 20 L5 22 M10 30 L6 34 M142 6 L146 2 M142 13 L147 13 M142 20 L147 22 M142 30 L146 34"
        stroke={PALETTE.oatShade}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="10" y="4" width="132" height="30" rx="4" fill={PALETTE.cream} {...inkRoom} />
      <g fill={PALETTE.teal}>
        <rect x="24" y="4.8" width="8" height="28.4" />
        <rect x="120" y="4.8" width="8" height="28.4" />
      </g>
      <g fill={PALETTE.berry}>
        <rect x="40" y="4.8" width="5" height="28.4" />
        <rect x="107" y="4.8" width="5" height="28.4" />
      </g>
      <path d="M62 19 L76 10 L90 19 L76 28 Z" fill={PALETTE.honey} {...inkRoom} strokeWidth="1" />
    </g>
  );
}

/* ------------------------------------------------------- floor_front 54 x 38 */

/** A stack of books with a mug on top. */
export function FloorBooks() {
  return (
    <g>
      <rect x="6" y="28" width="42" height="9" rx="2" fill={PALETTE.denim} {...inkRoom} />
      <rect x="10" y="20" width="36" height="8" rx="2" fill={PALETTE.honey} {...inkRoom} />
      <rect x="4" y="12" width="40" height="8" rx="2" fill={PALETTE.berry} {...inkRoom} />
      <path
        d="M8 32 L44 32 M14 24 L42 24 M8 16 L40 16"
        stroke="#fff"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      <path d="M20 2 L21 12 L31 12 L32 2 Z" fill={PALETTE.sage} {...inkRoom} />
      <path d="M32 4 C37 4 37 10 31 10" fill="none" stroke={INK} strokeWidth="1.5" />
    </g>
  );
}

/** A wicker basket of yarn balls. Starter. */
export function FloorYarnBasket() {
  return (
    <g>
      <circle cx="18" cy="16" r="9" fill={PALETTE.berry} {...inkRoom} />
      <path
        d="M11 12 Q18 18 24 9 M12 20 Q20 14 26 19"
        fill="none"
        stroke={PALETTE.berryShade}
        strokeWidth="1"
      />
      <circle cx="35" cy="15" r="8" fill={PALETTE.sky} {...inkRoom} />
      <path d="M29 12 Q35 18 41 12" fill="none" stroke={PALETTE.skyShade} strokeWidth="1" />
      <path d="M40 20 C50 22 46 30 52 32" fill="none" stroke={PALETTE.sky} strokeWidth="1.5" />
      <path d="M6 20 L10 37 L44 37 L48 20 Z" fill={PALETTE.woodLight} {...inkRoom} />
      <path d="M8 26 L46 26 M9 31 L45 31" stroke={PALETTE.wood} strokeWidth="1.2" />
      <rect x="4" y="18" width="46" height="5" rx="2.5" fill={PALETTE.wood} {...inkRoom} />
    </g>
  );
}

/* ------------------------------------------------ new items (wall, window, corner, table, seat, floor) */

/** A frame of pressed wildflowers on cream paper. */
export function WallLeftPressedFlowers() {
  return (
    <g>
      <path d="M18 8 L32 -2 L46 8" fill="none" stroke={INK} strokeWidth="1.2" />
      <circle cx="32" cy="-2" r="1.6" fill={INK} />
      <rect x="4" y="6" width="56" height="46" rx="4" fill={PALETTE.wood} {...inkRoom} />
      <rect
        x="10"
        y="12"
        width="44"
        height="34"
        rx="2"
        fill={PALETTE.cream}
        {...inkRoom}
        strokeWidth="1"
      />
      <path
        d="M32 44 C31 36 33 28 32 20"
        fill="none"
        stroke={PALETTE.leafShade}
        strokeWidth="1.5"
      />
      <path d="M32 36 C26 36 22 32 22 28 C27 28 31 31 32 36 Z" fill={PALETTE.leaf} />
      <path d="M32 31 C38 31 42 27 42 23 C37 23 33 26 32 31 Z" fill={PALETTE.leaf} />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle
          key={a}
          cx={32 + Math.cos((a * Math.PI) / 180) * 3.4}
          cy={18 + Math.sin((a * Math.PI) / 180) * 3.4}
          r="3"
          fill={PALETTE.rose}
          stroke={INK}
          strokeWidth="0.8"
        />
      ))}
      <circle cx="32" cy="18" r="2" fill={PALETTE.honey} />
      <circle cx="18" cy="38" r="2.6" fill={PALETTE.lilac} stroke={INK} strokeWidth="0.8" />
      <circle cx="46" cy="38" r="2.6" fill={PALETTE.lilac} stroke={INK} strokeWidth="0.8" />
      <path d="M8 14 L8 26" {...shine} />
    </g>
  );
}

/** A hanging pot with a trailing plant on rope. */
export function WallRightPlantHanger() {
  return (
    <g>
      <circle cx="33" cy="3" r="2.4" fill={PALETTE.wood} {...inkRoom} strokeWidth="1.2" />
      <path
        d="M33 4 L16 26 M33 4 L50 26 M33 4 L33 27"
        fill="none"
        stroke={PALETTE.oatShade}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M24 24 C20 34 22 40 24 56 M42 24 C46 34 44 42 42 52 M33 28 C36 38 33 46 35 58"
        fill="none"
        stroke={PALETTE.leafShade}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g fill={PALETTE.leaf} {...inkRoom} strokeWidth="1">
        <ellipse cx="26" cy="20" rx="5" ry="7" transform="rotate(-25 26 20)" />
        <ellipse cx="40" cy="20" rx="5" ry="7" transform="rotate(25 40 20)" />
        <ellipse cx="33" cy="17" rx="4.5" ry="7" />
        <ellipse cx="22" cy="44" rx="2.8" ry="3.8" />
        <ellipse cx="23" cy="54" rx="2.8" ry="3.8" />
        <ellipse cx="43" cy="46" rx="2.8" ry="3.8" />
        <ellipse cx="35" cy="56" rx="2.8" ry="3.8" />
      </g>
      <path d="M17 26 L49 26 L45 40 Q33 45 21 40 Z" fill={PALETTE.rust} {...inkRoom} />
      <rect x="15" y="23" width="36" height="6" rx="3" fill={PALETTE.rustShade} {...inkRoom} />
      <path d="M21 32 L22 37" {...shine} />
    </g>
  );
}

/** A round goldfish bowl on the sill. */
export function WindowGoldfishBowl() {
  return (
    <g>
      <path
        d="M22 7 C10 10 10 25 22 27 L46 27 C58 25 58 10 46 7 Z"
        fill={PALETTE.sky}
        fillOpacity="0.55"
        {...inkRoom}
      />
      <path d="M13 22 C16 27 22 27 22 27 L46 27 C46 27 52 27 55 22 Z" fill={PALETTE.honey} />
      <ellipse cx="34" cy="7" rx="12" ry="2.6" fill="none" {...inkRoom} />
      <path
        d="M44 27 C42 20 46 16 44 12"
        fill="none"
        stroke={PALETTE.leaf}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M26 15 L20 11 L20 19 Z" fill={PALETTE.rose} {...inkRoom} strokeWidth="1.2" />
      <ellipse cx="32" cy="15" rx="7" ry="4.6" fill={PALETTE.rust} {...inkRoom} strokeWidth="1.2" />
      <circle cx="36" cy="14" r="1.1" fill={INK} />
      <circle cx="42" cy="9" r="1.2" fill={PALETTE.snow} opacity="0.7" />
      <circle cx="45" cy="6" r="0.9" fill={PALETTE.snow} opacity="0.7" />
      <path d="M15 13 Q14 18 17 21" {...shine} />
    </g>
  );
}

/** A clay stand holding a few umbrellas. */
export function CornerUmbrellaStand() {
  return (
    <g>
      <path d="M12 62 C10 40 12 24 15 8 C20 24 22 42 22 62 Z" fill={PALETTE.berry} {...inkRoom} />
      <path d="M12 30 L22 30" stroke={PALETTE.berryShade} strokeWidth="2" strokeLinecap="round" />
      <path d="M26 64 C26 46 28 30 32 14 C37 30 38 48 36 64 Z" fill={PALETTE.denim} {...inkRoom} />
      <path d="M27 36 L37 36" stroke={PALETTE.denimShade} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M38 66 L38 28 C38 18 30 18 30 24"
        fill="none"
        stroke={INK}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M38 66 L38 28 C38 18 30 18 30 24"
        fill="none"
        stroke={PALETTE.honey}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M8 94 L6 60 L38 60 L36 94 Z" fill={PALETTE.teal} {...inkRoom} />
      <rect x="4" y="56" width="36" height="8" rx="3" fill={PALETTE.tealShade} {...inkRoom} />
      <path d="M11 68 L12 86" {...shine} />
    </g>
  );
}

/** A writing desk with a notebook and a quill in an inkwell. */
export function TableWritingDesk() {
  return (
    <g>
      <rect x="6" y="52" width="7" height="36" rx="2" fill={PALETTE.woodShade} {...inkRoom} />
      <rect x="80" y="52" width="7" height="36" rx="2" fill={PALETTE.woodShade} {...inkRoom} />
      <rect x="13" y="54" width="36" height="22" rx="3" fill={PALETTE.woodLight} {...inkRoom} />
      <path d="M17 66 L45 66" stroke={PALETTE.wood} strokeWidth="1.2" />
      <circle cx="31" cy="60" r="2" fill={PALETTE.honey} {...inkRoom} strokeWidth="1" />
      <circle cx="31" cy="71" r="2" fill={PALETTE.honey} {...inkRoom} strokeWidth="1" />
      <rect x="2" y="44" width="88" height="9" rx="3" fill={PALETTE.wood} {...inkRoom} />
      <path d="M8 48 L84 48" stroke={PALETTE.woodLight} strokeWidth="1.2" />
      <path
        d="M10 43 L28 44.5 L28 33 L10 31 Z"
        fill={PALETTE.cream}
        {...inkRoom}
        strokeWidth="1.2"
      />
      <path
        d="M46 43 L28 44.5 L28 33 L46 31 Z"
        fill={PALETTE.creamShade}
        {...inkRoom}
        strokeWidth="1.2"
      />
      <path
        d="M13 35 L25 36 M13 39 L25 40 M31 36 L43 35 M31 40 L43 39"
        stroke={PALETTE.oatShade}
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M68 37 C70 26 76 16 84 8 C82 18 80 28 72 37 Z"
        fill={PALETTE.cream}
        {...inkRoom}
        strokeWidth="1.2"
      />
      <path d="M70 36 C74 28 78 20 84 8" fill="none" stroke={PALETTE.oatShade} strokeWidth="1" />
      <path
        d="M62 44 L62 38 Q62 34 66 34 L74 34 Q78 34 78 38 L78 44 Z"
        fill={PALETTE.denim}
        {...inkRoom}
      />
      <rect
        x="66"
        y="31"
        width="8"
        height="4"
        rx="1.5"
        fill={PALETTE.denimShade}
        {...inkRoom}
        strokeWidth="1.2"
      />
      <path d="M65 38 L65 42" {...shine} strokeWidth="1.6" />
    </g>
  );
}

/** A wooden rocking chair with a rose cushion. */
export function SeatRockingChair() {
  return (
    <g>
      <path d="M6 80 Q50 94 94 80" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path
        d="M6 80 Q50 94 94 80"
        fill="none"
        stroke={PALETTE.woodLight}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M28 56 L24 82 M72 56 L76 82"
        stroke={PALETTE.woodShade}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="24" y="4" width="52" height="8" rx="4" fill={PALETTE.wood} {...inkRoom} />
      <rect x="27" y="12" width="46" height="36" rx="5" fill={PALETTE.woodLight} {...inkRoom} />
      <path
        d="M36 14 L36 46 M45 14 L45 46 M54 14 L54 46 M63 14 L63 46"
        stroke={PALETTE.wood}
        strokeWidth="1.5"
      />
      <rect x="14" y="36" width="9" height="26" rx="4.5" fill={PALETTE.wood} {...inkRoom} />
      <rect x="77" y="36" width="9" height="26" rx="4.5" fill={PALETTE.wood} {...inkRoom} />
      <rect x="18" y="52" width="64" height="13" rx="6.5" fill={PALETTE.rose} {...inkRoom} />
      <path d="M26 56 Q36 54 48 55" {...shine} />
      <circle cx="50" cy="58.5" r="1.4" fill={PALETTE.roseShade} />
    </g>
  );
}

/** A pile of soft floor cushions. */
export function FloorFrontCushions() {
  return (
    <g>
      <rect x="3" y="24" width="48" height="13" rx="6.5" fill={PALETTE.lilac} {...inkRoom} />
      <circle cx="27" cy="30.5" r="1.6" fill={PALETTE.lilacShade} />
      <rect
        x="9"
        y="13"
        width="36"
        height="12"
        rx="6"
        fill={PALETTE.rose}
        {...inkRoom}
        transform="rotate(-4 27 19)"
      />
      <path d="M14 18 Q22 15 30 16" {...shine} />
      <rect
        x="17"
        y="3"
        width="22"
        height="11"
        rx="5.5"
        fill={PALETTE.sage}
        {...inkRoom}
        transform="rotate(5 28 8)"
      />
      <circle cx="28" cy="8.5" r="1.4" fill={PALETTE.sageShade} />
    </g>
  );
}
