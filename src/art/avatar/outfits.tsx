import { HIGHLIGHT_OPACITY, inkAvatar, PALETTE } from '../style';
import type { AvatarItemArt } from './types';

/** Outfits: the torso from y 86 down to the bottom edge (see src/art/style.ts). */

/** Moss-green traveller's tunic with a laced V neck. Starter item. */
export const outfitTunic: AvatarItemArt = {
  body: () => (
    <g>
      <path
        d="M14 122 C15 100 30 89 50 86 L60 100 L70 86 C90 89 105 100 106 122 Z"
        fill={PALETTE.moss}
        {...inkAvatar}
      />
      <path
        d="M86 92 C97 99 104 108 105 121 L92 121 C92 110 90 100 86 92 Z"
        fill={PALETTE.mossShade}
      />
      <path
        d="M50 86 L60 100 L70 86"
        fill="none"
        stroke={PALETTE.oat}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M55.5 91.5 L64.5 91.5 M57 95.5 L63 95.5"
        stroke={PALETTE.oatShade}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M26 104 Q30 97 37 94"
        fill="none"
        stroke="#fff"
        strokeOpacity={HIGHLIGHT_OPACITY}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  ),
};

/** Cozy teal hoodie with the hood resting on the shoulders. */
export const outfitHoodie: AvatarItemArt = {
  back: () => (
    <path
      d="M30 96 C26 80 40 72 60 73 C80 72 94 80 90 96 Z"
      fill={PALETTE.tealShade}
      {...inkAvatar}
    />
  ),
  body: () => (
    <g>
      <path
        d="M14 122 C15 100 30 89 50 87 C54 92 66 92 70 87 C90 89 105 100 106 122 Z"
        fill={PALETTE.teal}
        {...inkAvatar}
      />
      <path d="M38 122 L42 108 L78 108 L82 122 Z" fill={PALETTE.tealShade} {...inkAvatar} />
      <path
        d="M24 106 Q29 97 37 94"
        fill="none"
        stroke="#fff"
        strokeOpacity={HIGHLIGHT_OPACITY}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  ),
  neck: () => (
    <g stroke={PALETTE.cream} strokeWidth="2" strokeLinecap="round">
      <path d="M54.5 92 L53.5 104" />
      <path d="M65.5 92 L66.5 104" />
      <circle cx="53.4" cy="105.5" r="1.6" fill={PALETTE.cream} />
      <circle cx="66.6" cy="105.5" r="1.6" fill={PALETTE.cream} />
    </g>
  ),
};

/** Denim overalls over a cream shirt. */
export const outfitOveralls: AvatarItemArt = {
  body: () => (
    <g>
      <path
        d="M14 122 C15 100 30 89 50 87 C54 92 66 92 70 87 C90 89 105 100 106 122 Z"
        fill={PALETTE.cream}
        {...inkAvatar}
      />
      <path
        d="M24 112 Q22 104 30 96 M96 112 Q98 104 90 96"
        fill="none"
        stroke={PALETTE.rose}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M41 98 L36 89 L43 87.5 L48 98 Z" fill={PALETTE.denim} {...inkAvatar} />
      <path d="M79 98 L84 89 L77 87.5 L72 98 Z" fill={PALETTE.denim} {...inkAvatar} />
      <path
        d="M40 122 L40 102 Q40 98 44 98 L76 98 Q80 98 80 102 L80 122 Z"
        fill={PALETTE.denim}
        {...inkAvatar}
      />
      <rect x="52" y="104" width="16" height="11" rx="3" fill={PALETTE.denimShade} {...inkAvatar} />
      <circle cx="45" cy="102.5" r="2.2" fill={PALETTE.honey} {...inkAvatar} strokeWidth="1.2" />
      <circle cx="75" cy="102.5" r="2.2" fill={PALETTE.honey} {...inkAvatar} strokeWidth="1.2" />
    </g>
  ),
};

/** Midnight robe sprinkled with tiny stars. Rare. */
export const outfitStarRobe: AvatarItemArt = {
  body: () => (
    <g>
      <path
        d="M14 122 C15 100 30 89 50 86 L62 106 L70 86 C90 89 105 100 106 122 Z"
        fill="#46407a"
        {...inkAvatar}
      />
      <path d="M50 86 L62 106 L58 122 L50 122 C50 108 48 96 50 86 Z" fill="#383365" />
      <path
        d="M50 86 L62 106 L70 86"
        fill="none"
        stroke={PALETTE.honey}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g fill={PALETTE.honey}>
        <path d="M30 104 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4Z" />
        <path d="M84 100 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2Z" />
        <path d="M74 114 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1Z" />
        <circle cx="40" cy="116" r="1.3" />
        <circle cx="92" cy="114" r="1.3" />
        <circle cx="24" cy="116" r="1" />
      </g>
    </g>
  ),
};
