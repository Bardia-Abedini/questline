/* eslint-disable react-refresh/only-export-components -- art registries export plain objects of small components */
import { HIGHLIGHT_OPACITY, inkAvatar } from '../style';
import type { AvatarArtProps, AvatarItemArt } from './types';

/** Hair styles. Colors come from the wearer's hair swatch (`hair.base/shade/light`). */

function Shine({ d }: { d: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="#fff"
      strokeOpacity={HIGHLIGHT_OPACITY}
      strokeWidth="3"
      strokeLinecap="round"
    />
  );
}

/** Short and tidy, with a soft side-swept fringe. Starter item. */
export const hairShort: AvatarItemArt = {
  hair: ({ hair }: AvatarArtProps) => (
    <g>
      <path
        d="M33 60 C29 38 42 23 60 23 C78 23 91 37 87 60 C85 51 82 45 77 41 C70 46 58 46 50 40 C46 45 40 47 37 51 C35 54 34 57 33 60 Z"
        fill={hair.base}
        {...inkAvatar}
      />
      <path d="M77 41 C80 44 83 49 85 54 C86 46 84 38 79 33 Z" fill={hair.shade} />
      <Shine d="M45 31 Q54 26.5 64 27.5" />
    </g>
  ),
};

/** Long and flowing past the shoulders, parted in the middle. Starter item. */
export const hairLong: AvatarItemArt = {
  back: ({ hair }: AvatarArtProps) => (
    <path
      d="M34 46 C33 32 45 26 60 26 C75 26 87 32 86 46 L93 98 C86 105 74 103 68 98 L52 98 C46 103 34 105 27 98 Z"
      fill={hair.shade}
      {...inkAvatar}
    />
  ),
  hair: ({ hair }: AvatarArtProps) => (
    <g>
      <path
        d="M33 66 C29 40 41 23 60 23 C79 23 91 40 87 66 C85 56 80 47 74 41 C68 38 63 36 60 33 C57 36 52 38 46 41 C40 47 35 56 33 66 Z"
        fill={hair.base}
        {...inkAvatar}
      />
      <path d="M60 26 L60 33" stroke={hair.shade} strokeWidth="2" strokeLinecap="round" />
      <Shine d="M42 34 Q48 28 55 27" />
    </g>
  ),
};

/** A soft cloud of curls. */
export const hairCurly: AvatarItemArt = {
  back: ({ hair }: AvatarArtProps) => (
    <g fill={hair.shade} {...inkAvatar}>
      <circle cx="34" cy="62" r="8" />
      <circle cx="86" cy="62" r="8" />
    </g>
  ),
  hair: ({ hair }: AvatarArtProps) => (
    <g>
      <g fill={hair.base} {...inkAvatar}>
        <circle cx="60" cy="35" r="15" />
        <circle cx="36" cy="51" r="8" />
        <circle cx="84" cy="51" r="8" />
        <circle cx="39" cy="40" r="9" />
        <circle cx="81" cy="40" r="9" />
        <circle cx="47" cy="30" r="10" />
        <circle cx="73" cy="30" r="10" />
        <circle cx="60" cy="25" r="10.5" />
        <circle cx="52" cy="42" r="6.5" />
        <circle cx="68" cy="42" r="6.5" />
      </g>
      <path
        d="M44 27 Q47 24 51 25 M57 21 Q60 19 63 21 M70 25 Q74 25 76 28"
        fill="none"
        stroke={hair.light}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  ),
};

/** A round bun on top, tied with a little ribbon. */
export const hairBun: AvatarItemArt = {
  hair: ({ hair }: AvatarArtProps) => (
    <g>
      <circle cx="60" cy="17" r="10" fill={hair.base} {...inkAvatar} />
      <path
        d="M34 57 C31 37 44 24 60 24 C76 24 89 37 86 57 C84 48 78 41 70 38 C64 40 56 40 50 38 C42 41 36 48 34 57 Z"
        fill={hair.base}
        {...inkAvatar}
      />
      <rect x="54" y="23" width="12" height="5" rx="2.5" fill="#d9637a" {...inkAvatar} />
      <path d="M55 13 Q60 9.5 65 13" fill="none" stroke={hair.light} strokeWidth="2" />
      <Shine d="M44 33 Q50 28.5 57 28.5" />
    </g>
  ),
};
