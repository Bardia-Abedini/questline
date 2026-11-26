/* eslint-disable react-refresh/only-export-components -- art registries export plain objects of small components */
import { INK, inkAvatar, PALETTE } from '../style';
import type { AvatarItemArt } from './types';

/** Accessories: glasses on the eyes layer, scarves on the neck layer, earrings on the ears. */

/** Round reading glasses. */
export const accGlasses: AvatarItemArt = {
  eyes: () => (
    <g fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
      <circle cx="51" cy="56.5" r="6.8" fill="#fff" fillOpacity="0.22" />
      <circle cx="69" cy="56.5" r="6.8" fill="#fff" fillOpacity="0.22" />
      <path d="M57.6 55.4 Q60 53.6 62.4 55.4" />
      <path d="M44.3 55 L36.5 53" />
      <path d="M75.7 55 L83.5 53" />
      <path d="M47.5 53 Q49 51.6 50.8 51.6" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.4" />
    </g>
  ),
};

/** A long striped knitted scarf. */
export const accScarf: AvatarItemArt = {
  neck: () => (
    <g>
      <path d="M64 90 L70 112 L61 114 L58 92 Z" fill={PALETTE.rustShade} {...inkAvatar} />
      <path
        d="M65.6 98 L60.4 99 M67.4 105 L61.6 106"
        stroke={PALETTE.cream}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M42 80 C50 86 70 86 78 80 L79 89 C71 96 49 96 41 89 Z"
        fill={PALETTE.rust}
        {...inkAvatar}
      />
      <path
        d="M47 84.5 L46.5 92 M55 86.5 L55 94 M65 86.5 L65 94 M73 84.5 L73.5 92"
        stroke={PALETTE.cream}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  ),
};

function Leaf({ x }: { x: number }) {
  return (
    <g>
      <path d={`M${x} 61 L${x} 64`} stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      <path
        d={`M${x} 64 C${x - 4} 67 ${x - 3} 72 ${x} 74 C${x + 3} 72 ${x + 4} 67 ${x} 64 Z`}
        fill={PALETTE.leaf}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d={`M${x} 66 L${x} 72`} stroke={PALETTE.sage} strokeWidth="0.9" />
    </g>
  );
}

/** Tiny leaf earrings. */
export const accLeafEarrings: AvatarItemArt = {
  eyes: () => (
    <g>
      <Leaf x={34.5} />
      <Leaf x={85.5} />
    </g>
  ),
};

function starPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.5;
    return `${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
  });
  return `M${pts.join(' L')} Z`;
}

function StarDrop({ x }: { x: number }) {
  return (
    <g>
      <path d={`M${x} 61 L${x} 66`} stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      <path
        d={starPath(x, 71, 5.4)}
        fill={PALETTE.honey}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Little golden star earrings. */
export const accStarEarrings: AvatarItemArt = {
  eyes: () => (
    <g>
      <StarDrop x={34.5} />
      <StarDrop x={85.5} />
    </g>
  ),
};

/** A rose flower clipped into the hair above the ear. */
export const accFlowerHairclip: AvatarItemArt = {
  eyes: () => (
    <g>
      <path
        d="M70 41 C74 44 80 44 84 41"
        fill="none"
        stroke={PALETTE.leafShade}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <ellipse
        cx="83"
        cy="45"
        rx="4.5"
        ry="2.2"
        fill={PALETTE.leaf}
        stroke={INK}
        strokeWidth="1.2"
        transform="rotate(40 83 45)"
      />
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <circle
            key={a}
            cx={76 + Math.cos(rad) * 3.6}
            cy={39 + Math.sin(rad) * 3.6}
            r="3.4"
            fill={PALETTE.rose}
            stroke={INK}
            strokeWidth="1.2"
          />
        );
      })}
      <circle cx="76" cy="39" r="2.6" fill={PALETTE.honey} stroke={INK} strokeWidth="1.2" />
    </g>
  ),
};
