/* eslint-disable react-refresh/only-export-components -- art registries export plain objects of small components */
import { HIGHLIGHT_OPACITY, inkAvatar, PALETTE } from '../style';
import type { AvatarItemArt } from './types';

/** Hats: brim around y 30..38, may rise to y 0 (see src/art/style.ts). */

/** Knitted berry beanie with a fluffy pompom. */
export const hatBeanie: AvatarItemArt = {
  hat: () => (
    <g>
      <circle cx="60" cy="12" r="7" fill={PALETTE.cream} {...inkAvatar} />
      <path
        d="M33 40 C32 22 45 15 60 15 C75 15 88 22 87 40 Z"
        fill={PALETTE.berry}
        {...inkAvatar}
      />
      <path
        d="M44 22 Q50 18.5 57 18.5"
        fill="none"
        stroke="#fff"
        strokeOpacity={HIGHLIGHT_OPACITY}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="30" y="35" width="60" height="11" rx="5.5" fill={PALETTE.rose} {...inkAvatar} />
      <path
        d="M38 37.5 V43.5 M46 37.5 V43.5 M54 37.5 V43.5 M62 37.5 V43.5 M70 37.5 V43.5 M78 37.5 V43.5"
        stroke={PALETTE.roseShade}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  ),
};

/** A tall, softly bent star-gazer's hat. Rare. */
export const hatWizard: AvatarItemArt = {
  hat: () => (
    <g>
      <ellipse cx="60" cy="35" rx="34" ry="7.5" fill={PALETTE.plumShade} {...inkAvatar} />
      <path
        d="M40 34 C47 24 52 12 58 4 C61 0 68 1 70 5 C71 8 68 9 66 7 C66 16 74 26 80 34 Z"
        fill={PALETTE.plum}
        {...inkAvatar}
      />
      <path
        d="M41.5 31 C50 33.5 70 33.5 78.5 31 L80 34 C70 37 50 37 40 34 Z"
        fill={PALETTE.honey}
        {...inkAvatar}
        strokeWidth="1.5"
      />
      <path
        d="M62 14 l1.8 3.8 3.8 1.8 -3.8 1.8 -1.8 3.8 -1.8 -3.8 -3.8 -1.8 3.8 -1.8Z"
        fill={PALETTE.honey}
      />
      <circle cx="52" cy="26" r="1.3" fill={PALETTE.cream} />
      <circle cx="70" cy="27" r="1.1" fill={PALETTE.cream} />
    </g>
  ),
};

function Flower({ x, y, petal, r = 3 }: { x: number; y: number; petal: string; r?: number }) {
  const d = r * 0.95;
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <circle
            key={a}
            cx={x + Math.cos(rad) * d}
            cy={y + Math.sin(rad) * d}
            r={r}
            fill={petal}
            stroke="#4a3428"
            strokeWidth="1"
          />
        );
      })}
      <circle cx={x} cy={y} r={r * 0.7} fill={PALETTE.honey} stroke="#4a3428" strokeWidth="1" />
    </g>
  );
}

/** A ring of meadow flowers. */
export const hatFlowerCrown: AvatarItemArt = {
  hat: () => (
    <g>
      <path
        d="M34 42 C39 31 49 26 60 26 C71 26 81 31 86 42"
        fill="none"
        stroke={PALETTE.leafShade}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g fill={PALETTE.leaf} stroke="#4a3428" strokeWidth="1">
        <ellipse cx="42" cy="32" rx="4.5" ry="2.2" transform="rotate(-35 42 32)" />
        <ellipse cx="66" cy="25.5" rx="4.5" ry="2.2" transform="rotate(10 66 25.5)" />
        <ellipse cx="80" cy="34" rx="4.5" ry="2.2" transform="rotate(40 80 34)" />
      </g>
      <Flower x={37} y={38} petal={PALETTE.rose} />
      <Flower x={48} y={29} petal={PALETTE.cream} />
      <Flower x={60} y={25.5} petal={PALETTE.lilac} r={3.4} />
      <Flower x={72} y={29} petal={PALETTE.cream} />
      <Flower x={83} y={38} petal={PALETTE.rose} />
    </g>
  ),
};
