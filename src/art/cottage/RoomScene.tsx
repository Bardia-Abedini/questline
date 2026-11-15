import { useId, type FC } from 'react';
import '../art.css';
import { INK, inkRoom, PALETTE } from '../style';
import { DECOR_ART, FLOOR_ART, PET_ART, WALLPAPER_ART } from './registry';
import { PET_BOX, SLOT_BOXES, type DecorSlot } from './slots';
import { FloorPlanks, WallCream } from './surfaces';

export interface RoomLook {
  /** Slot id -> item id (null = empty). Already resolved (defaults applied). */
  slots: Partial<Record<DecorSlot, string | null>>;
  pet: string | null;
  wallpaper: string | null;
  floor: string | null;
}

export interface RoomSceneProps {
  look: RoomLook;
  /** Outline one slot (while choosing a decoration for it). */
  highlight?: DecorSlot | 'pet' | null;
  title?: string;
  className?: string;
}

/** Drawn back to front so floor items overlap the rug and wall. */
const DRAW_ORDER: DecorSlot[] = [
  'bunting',
  'wall_left',
  'wall_right',
  'window',
  'lamp',
  'rug',
  'corner',
  'table',
  'seat',
];

function Placed({ slot, id }: { slot: DecorSlot; id: string | null | undefined }) {
  const Art: FC | undefined = id ? DECOR_ART[id] : undefined;
  if (!Art) return null;
  const b = SLOT_BOXES[slot];
  return (
    <g transform={`translate(${b.x} ${b.y})`} data-slot={slot} data-item={id}>
      <Art />
    </g>
  );
}

/**
 * The cottage room: one cozy scene with ten decoration slots and a pet. Daytime in the light
 * theme, a lamp-lit evening in the dark theme.
 */
export function RoomScene({ look, highlight, title, className }: RoomSceneProps) {
  const uid = useId().replace(/:/g, '');
  const Wallpaper = (look.wallpaper && WALLPAPER_ART[look.wallpaper]) || WallCream;
  const Floor = (look.floor && FLOOR_ART[look.floor]) || FloorPlanks;
  const Pet = look.pet ? PET_ART[look.pet] : undefined;
  const hl = highlight ? (highlight === 'pet' ? PET_BOX : SLOT_BOXES[highlight]) : null;

  return (
    <svg
      viewBox="0 0 360 240"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--qa-sky-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--qa-sky-bottom)' }} />
        </linearGradient>
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0" style={{ stopColor: 'var(--qa-glow)' }} />
          <stop offset="1" stopColor="#ffc878" stopOpacity="0" />
        </radialGradient>
      </defs>

      <Wallpaper />
      {/* ceiling beam */}
      <rect x="0" y="0" width="360" height="10" fill={PALETTE.woodShade} />
      <path d="M0 10 L360 10" stroke={INK} strokeWidth="1.5" />

      {/* window */}
      <path
        d="M138 114 L138 56 Q138 32 180 32 Q222 32 222 56 L222 114 Z"
        fill={PALETTE.woodLight}
        {...inkRoom}
      />
      <path
        d="M145 108 L145 58 Q145 39 180 39 Q215 39 215 58 L215 108 Z"
        fill={`url(#sky-${uid})`}
        {...inkRoom}
      />
      <g className="qa-day">
        <circle cx="201" cy="56" r="7.5" fill={PALETTE.honey} />
        <g fill="#fff" opacity="0.9">
          <ellipse cx="160" cy="70" rx="9" ry="5" />
          <ellipse cx="168" cy="67" rx="7" ry="5" />
          <ellipse cx="196" cy="92" rx="8" ry="4" />
        </g>
        <path d="M150 104 Q165 90 180 98 Q195 88 210 100 L210 104 Z" fill={PALETTE.sage} />
      </g>
      <g className="qa-night">
        <path d="M204 50 A9 9 0 1 0 204 66 A7 7 0 1 1 204 50 Z" fill="#fff4cf" />
        <g fill="#fff4cf">
          <circle cx="158" cy="54" r="1.2" />
          <circle cx="170" cy="74" r="1" />
          <circle cx="190" cy="48" r="1.1" />
          <circle cx="160" cy="92" r="0.9" />
          <circle cx="206" cy="86" r="1" />
        </g>
        <path d="M150 104 Q165 90 180 98 Q195 88 210 100 L210 104 Z" fill="#4a4a6e" />
      </g>
      <path d="M180 39 L180 108 M145 74 L215 74" stroke={PALETTE.woodLight} strokeWidth="3.5" />
      <path d="M180 39 L180 108 M145 74 L215 74" stroke={INK} strokeWidth="1" opacity="0.4" />
      <rect x="132" y="110" width="96" height="7" rx="3" fill={PALETTE.wood} {...inkRoom} />

      {/* floor and baseboard */}
      <Floor />
      <rect x="0" y="164" width="360" height="7" fill={PALETTE.wood} />
      <path d="M0 164 L360 164 M0 171 L360 171" stroke={INK} strokeWidth="1.2" />

      {/* evening: the room dims, the decorations stay lamp-lit */}
      <rect
        x="0"
        y="0"
        width="360"
        height="240"
        style={{ fill: 'var(--qa-room-tint)', mixBlendMode: 'multiply' }}
      />

      {DRAW_ORDER.map((slot) => (
        <Placed key={slot} slot={slot} id={look.slots[slot]} />
      ))}
      {Pet && (
        <g transform={`translate(${PET_BOX.x} ${PET_BOX.y})`} data-slot="pet" data-item={look.pet}>
          <Pet />
        </g>
      )}
      <Placed slot="floor_front" id={look.slots.floor_front} />

      <circle cx="180" cy="120" r="170" fill={`url(#glow-${uid})`} pointerEvents="none" />

      {hl && (
        <rect
          x={hl.x - 3}
          y={hl.y - 3}
          width={hl.w + 6}
          height={hl.h + 6}
          rx="8"
          fill="var(--ql-primary)"
          fillOpacity="0.1"
          stroke="var(--ql-primary)"
          strokeWidth="2.5"
          strokeDasharray="6 5"
        />
      )}
    </svg>
  );
}
