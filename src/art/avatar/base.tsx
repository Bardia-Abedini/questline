import { INK, inkAvatar } from '../style';
import type { AvatarArtProps } from './types';

/**
 * The parts every avatar has: neck, ears, head and a friendly face. Drawn by AvatarSvg
 * between the item layers (see the layer order in src/art/style.ts).
 */

export function AvatarNeck({ skin }: AvatarArtProps) {
  return (
    <g>
      <rect x="52" y="66" width="16" height="46" rx="6" fill={skin.base} {...inkAvatar} />
      <ellipse cx="60" cy="75" rx="8" ry="3.2" fill={skin.shade} />
    </g>
  );
}

export function AvatarHead({ skin }: AvatarArtProps) {
  return (
    <g>
      <circle cx="35.5" cy="57" r="5.5" fill={skin.base} {...inkAvatar} />
      <circle cx="84.5" cy="57" r="5.5" fill={skin.base} {...inkAvatar} />
      <path d="M34.5 55.5 Q36.8 57 35 59.5" fill="none" stroke={skin.shade} strokeWidth="1.6" />
      <path d="M85.5 55.5 Q83.2 57 85 59.5" fill="none" stroke={skin.shade} strokeWidth="1.6" />
      <ellipse cx="60" cy="52" rx="25" ry="26" fill={skin.base} {...inkAvatar} />
    </g>
  );
}

export function AvatarFace({ skin }: AvatarArtProps) {
  return (
    <g>
      <path
        d="M46 47.6 Q50.5 45.6 55 47.4 M65 47.4 Q69.5 45.6 74 47.6"
        fill="none"
        stroke={INK}
        strokeOpacity="0.7"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <ellipse cx="45" cy="64" rx="4.6" ry="3" fill={skin.blush} opacity="0.5" />
      <ellipse cx="75" cy="64" rx="4.6" ry="3" fill={skin.blush} opacity="0.5" />
      <ellipse cx="51" cy="56.5" rx="2.8" ry="3.4" fill={INK} />
      <ellipse cx="69" cy="56.5" rx="2.8" ry="3.4" fill={INK} />
      <circle cx="52" cy="55.2" r="1" fill="#fff" />
      <circle cx="70" cy="55.2" r="1" fill="#fff" />
      <path
        d="M58.8 61.6 Q60 62.8 61.2 61.6"
        fill="none"
        stroke={skin.shade}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M55.5 66.5 Q60 70.6 64.5 66.5"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Plain shirt shown when no outfit is equipped. */
export function AvatarPlainShirt() {
  return (
    <path
      d="M14 122 C15 100 30 89 50 87 C54 91 66 91 70 87 C90 89 105 100 106 122 Z"
      fill="#efe3cf"
      {...inkAvatar}
    />
  );
}
