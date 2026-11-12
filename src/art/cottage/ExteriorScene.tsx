import { useId } from 'react';
import '../art.css';
import { INK, inkRoom, PALETTE } from '../style';

export interface ExteriorSceneProps {
  /** Cottage tier from `cottageTier(level)`: 0 at levels 1-4, 1 at 5-9, 2 at 10-14, ... */
  tier: number;
  title?: string;
  className?: string;
}

/** The highest tier with new details; later milestones keep the full cottage. */
export const MAX_EXTERIOR_TIER = 6;

function Flower({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <path d={`M${x} ${y} L${x} ${y + 8}`} stroke={PALETTE.leafShade} strokeWidth="1.5" />
      <circle cx={x} cy={y} r="3.2" fill={color} stroke={INK} strokeWidth="1" />
      <circle cx={x} cy={y} r="1.2" fill={PALETTE.honey} />
    </g>
  );
}

function LitWindow({
  x,
  y,
  w = 22,
  h = 22,
  round = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  round?: boolean;
}) {
  return (
    <g>
      {round ? (
        <circle
          cx={x + w / 2}
          cy={y + h / 2}
          r={w / 2}
          style={{ fill: 'var(--qa-window-light)' }}
          {...inkRoom}
        />
      ) : (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx="3"
          style={{ fill: 'var(--qa-window-light)' }}
          {...inkRoom}
        />
      )}
      <path
        d={`M${x + w / 2} ${y} L${x + w / 2} ${y + h} M${x} ${y + h / 2} L${x + w} ${y + h / 2}`}
        stroke={PALETTE.woodShade}
        strokeWidth="2"
      />
    </g>
  );
}

/**
 * The cottage from outside. It grows a little at every milestone level: flower boxes and a
 * fence (tier 1), a chimney and stone path (2), a tree and lantern (3), a side room (4),
 * a pond and banner (5) and a star-topped tower (6).
 */
export function ExteriorScene({ tier, title, className }: ExteriorSceneProps) {
  const uid = useId().replace(/:/g, '');
  const t = Math.max(0, Math.min(MAX_EXTERIOR_TIER, Math.floor(tier)));
  return (
    <svg
      viewBox="0 0 360 240"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-tier={t}
    >
      <defs>
        <linearGradient id={`exsky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--qa-sky-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--qa-sky-bottom)' }} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="360" height="240" fill={`url(#exsky-${uid})`} />
      <g className="qa-day">
        <circle cx="300" cy="44" r="18" fill={PALETTE.honey} />
        <g fill="#fff" opacity="0.92">
          <ellipse cx="70" cy="44" rx="22" ry="9" />
          <ellipse cx="88" cy="38" rx="14" ry="9" />
          <ellipse cx="220" cy="30" rx="16" ry="6" />
        </g>
      </g>
      <g className="qa-night">
        <path d="M304 26 A18 18 0 1 0 304 62 A14 14 0 1 1 304 26 Z" fill="#fff4cf" />
        <g fill="#fff4cf">
          {[
            [40, 30],
            [90, 60],
            [150, 22],
            [210, 50],
            [250, 18],
            [340, 80],
            [20, 90],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />
          ))}
        </g>
      </g>

      {/* hills and ground */}
      <path
        d="M0 150 Q60 110 130 140 Q200 104 270 136 Q320 118 360 132 L360 240 L0 240 Z"
        style={{ fill: 'var(--qa-hill)' }}
      />
      <path d="M0 178 Q180 160 360 178 L360 240 L0 240 Z" style={{ fill: 'var(--qa-ground)' }} />
      <path
        d="M0 214 Q180 200 360 214 L360 240 L0 240 Z"
        style={{ fill: 'var(--qa-ground-shade)' }}
      />

      {/* tier 5: pond */}
      {t >= 5 && (
        <g>
          <ellipse cx="298" cy="214" rx="40" ry="11" fill={PALETTE.sky} {...inkRoom} />
          <ellipse cx="288" cy="212" rx="8" ry="3" fill={PALETTE.leaf} />
          <circle cx="291" cy="211" r="2" fill={PALETTE.rose} />
          <path
            d="M306 216 Q314 213 322 216"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
        </g>
      )}

      {/* tier 3: tree on the left */}
      {t >= 3 && (
        <g>
          <path
            d="M52 190 L54 140 M54 160 L44 150"
            stroke={PALETTE.bark}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="54" cy="122" r="30" fill={PALETTE.moss} {...inkRoom} />
          <circle cx="36" cy="138" r="16" fill={PALETTE.moss} {...inkRoom} />
          <circle cx="72" cy="140" r="16" fill={PALETTE.mossShade} {...inkRoom} />
          <g fill={PALETTE.berry}>
            <circle cx="44" cy="116" r="3" />
            <circle cx="64" cy="108" r="3" />
            <circle cx="60" cy="132" r="3" />
          </g>
        </g>
      )}

      <g transform="translate(180 196) scale(1.22) translate(-180 -196)">
        {/* tier 6: tower behind the right side */}
        {t >= 6 && (
          <g>
            <rect x="212" y="70" width="34" height="86" rx="4" fill={PALETTE.stone} {...inkRoom} />
            <path d="M206 72 L229 34 L252 72 Z" fill={PALETTE.plum} {...inkRoom} />
            <path
              d="M229 20 l2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4Z"
              fill={PALETTE.honey}
              stroke={INK}
              strokeWidth="1"
            />
            <LitWindow x={221} y={86} w={16} h={20} />
          </g>
        )}

        {/* tier 4: side room on the right */}
        {t >= 4 && (
          <g>
            <rect x="226" y="140" width="56" height="52" rx="3" fill={PALETTE.oat} {...inkRoom} />
            <path d="M218 144 L254 116 L290 144 Z" fill={PALETTE.rust} {...inkRoom} />
            <LitWindow x={243} y={154} w={22} h={20} />
            <path d="M254 116 L254 102" stroke={INK} strokeWidth="1.5" />
            <path
              d="M254 102 L264 106 L254 109"
              fill={PALETTE.honey}
              stroke={INK}
              strokeWidth="1"
            />
          </g>
        )}

        {/* tier 2: chimney with smoke */}
        {t >= 2 && (
          <g>
            <rect x="198" y="84" width="16" height="34" fill={PALETTE.stone} {...inkRoom} />
            <rect
              x="195"
              y="80"
              width="22"
              height="7"
              rx="2"
              fill={PALETTE.stoneShade}
              {...inkRoom}
            />
            <g className="qa-bob" fill="#fff" opacity="0.75">
              <circle cx="207" cy="68" r="6" />
              <circle cx="214" cy="58" r="7" />
              <circle cx="224" cy="48" r="8" />
            </g>
          </g>
        )}

        {/* the cottage */}
        <rect x="128" y="122" width="104" height="70" rx="3" fill={PALETTE.cream} {...inkRoom} />
        <path d="M128 172 L232 172" stroke={PALETTE.creamShade} strokeWidth="2" />
        <path
          d="M114 128 C130 104 160 76 180 70 C200 76 230 104 246 128 C238 132 222 130 214 126 C206 132 190 132 180 128 C170 132 154 132 146 126 C138 130 122 132 114 128 Z"
          fill={PALETTE.honey}
          {...inkRoom}
        />
        <path
          d="M140 110 Q150 104 158 106 M196 104 Q206 104 214 110 M170 86 Q178 82 186 84"
          fill="none"
          stroke={PALETTE.honeyShade}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* door */}
        <path
          d="M168 192 L168 160 Q168 148 180 148 Q192 148 192 160 L192 192 Z"
          fill={PALETTE.rust}
          {...inkRoom}
        />
        <circle cx="187" cy="172" r="1.8" fill={PALETTE.honey} />
        <LitWindow x={140} y={142} round />
        {t >= 2 && <LitWindow x={202} y={142} />}

        {/* tier 1: flower boxes and fence */}
        {t >= 1 && (
          <g>
            <rect x="136" y="164" width="30" height="7" rx="2" fill={PALETTE.wood} {...inkRoom} />
            <Flower x={142} y={159} color={PALETTE.berry} />
            <Flower x={151} y={157} color={PALETTE.cream} />
            <Flower x={160} y={159} color={PALETTE.lilac} />
            <g fill={PALETTE.cream} {...inkRoom}>
              {[86, 100, 114].map((x) => (
                <path
                  key={x}
                  d={`M${x} 196 L${x} 176 L${x + 4} 172 L${x + 8} 176 L${x + 8} 196 Z`}
                />
              ))}
              {[246, 260, 274].map((x) => (
                <path
                  key={x}
                  d={`M${x} 198 L${x} 178 L${x + 4} 174 L${x + 8} 178 L${x + 8} 198 Z`}
                />
              ))}
            </g>
            <path
              d="M84 184 L124 184 M244 186 L284 186"
              stroke={PALETTE.woodLight}
              strokeWidth="3"
            />
          </g>
        )}

        {/* tier 2: stone path */}
        {t >= 2 && (
          <g fill={PALETTE.stone} {...inkRoom} strokeWidth="1">
            <ellipse cx="180" cy="200" rx="12" ry="4" />
            <ellipse cx="174" cy="212" rx="13" ry="4.5" />
            <ellipse cx="184" cy="226" rx="15" ry="5" />
          </g>
        )}

        {/* tier 3: lantern post */}
        {t >= 3 && (
          <g>
            <path d="M112 216 L112 170" stroke={PALETTE.slate} strokeWidth="3" />
            <circle
              className="qa-night qa-glow qa-flicker"
              cx="112"
              cy="164"
              r="14"
              fill={PALETTE.honey}
              opacity="0.35"
            />
            <rect
              x="105"
              y="156"
              width="14"
              height="16"
              rx="3"
              style={{ fill: 'var(--qa-window-light)' }}
              {...inkRoom}
            />
            <path d="M103 156 L112 150 L121 156 Z" fill={PALETTE.slate} {...inkRoom} />
          </g>
        )}

        {/* tier 5: banner on the roof */}
        {t >= 5 && (
          <g>
            <path d="M180 70 L180 46" stroke={INK} strokeWidth="1.5" />
            <path
              className="qa-swing"
              d="M180 47 L198 51 L180 56 Z"
              fill={PALETTE.berry}
              stroke={INK}
              strokeWidth="1"
            />
          </g>
        )}
      </g>
      {/* flowers in the grass for everyone */}
      <Flower x={30} y={206} color={PALETTE.rose} />
      <Flower x={330} y={192} color={PALETTE.cream} />
      <Flower x={96} y={218} color={PALETTE.lilac} />
    </svg>
  );
}
