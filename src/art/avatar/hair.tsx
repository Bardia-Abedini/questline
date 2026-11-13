/* eslint-disable react-refresh/only-export-components -- art registries export plain objects of small components */
import { HIGHLIGHT_OPACITY, inkAvatar, PALETTE } from '../style';
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

/** A chin-length bob with a straight fringe. */
export const hairBob: AvatarItemArt = {
  back: ({ hair }: AvatarArtProps) => (
    <path
      d="M33 46 C32 30 45 25 60 25 C75 25 88 30 87 46 L89 74 C82 80 73 79 68 74 L52 74 C47 79 38 80 31 74 Z"
      fill={hair.shade}
      {...inkAvatar}
    />
  ),
  hair: ({ hair }: AvatarArtProps) => (
    <g>
      <path
        d="M33 64 C29 38 42 23 60 23 C78 23 91 38 87 64 C85 54 82 48 78 44 C70 47 50 47 42 44 C38 48 35 54 33 64 Z"
        fill={hair.base}
        {...inkAvatar}
      />
      <Shine d="M44 31 Q52 26.5 62 27" />
    </g>
  ),
};

/** Two plaits over the shoulders, tied with little ribbons. */
export const hairBraids: AvatarItemArt = {
  hair: ({ hair }: AvatarArtProps) => (
    <g>
      {[30, 90].map((x) => (
        <g key={x}>
          <g fill={hair.base} {...inkAvatar} strokeWidth="1.6">
            <ellipse cx={x} cy="68" rx="6" ry="5" />
            <ellipse cx={x + (x < 60 ? 1 : -1)} cy="77" rx="5.6" ry="4.8" />
            <ellipse cx={x} cy="86" rx="5.2" ry="4.6" />
            <ellipse cx={x + (x < 60 ? 1 : -1)} cy="94" rx="4.8" ry="4.2" />
          </g>
          <rect
            x={x - 4.5}
            y="97"
            width="9"
            height="4.5"
            rx="2.2"
            fill={PALETTE.berry}
            {...inkAvatar}
            strokeWidth="1.4"
          />
        </g>
      ))}
      <path
        d="M33 62 C29 38 42 23 60 23 C78 23 91 38 87 62 C85 52 80 45 74 41 C68 38 63 36 60 33 C57 36 52 38 46 41 C40 45 35 52 33 62 Z"
        fill={hair.base}
        {...inkAvatar}
      />
      <path d="M60 26 L60 33" stroke={hair.shade} strokeWidth="2" strokeLinecap="round" />
      <Shine d="M43 33 Q49 28 56 27" />
    </g>
  ),
};

/** A high ponytail swinging out to one side. */
export const hairPonytail: AvatarItemArt = {
  back: ({ hair }: AvatarArtProps) => (
    <g>
      <path
        d="M74 30 C95 25 109 44 103 68 C101 78 96 84 91 87 C93 72 91 56 78 46 Z"
        fill={hair.shade}
        {...inkAvatar}
      />
      <path
        d="M97 40 Q102 50 100 62"
        fill="none"
        stroke={hair.light}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  ),
  hair: ({ hair }: AvatarArtProps) => (
    <g>
      <path
        d="M34 58 C31 38 44 24 60 24 C76 24 89 37 86 58 C84 49 78 42 70 39 C64 41 56 41 50 39 C42 42 36 49 34 58 Z"
        fill={hair.base}
        {...inkAvatar}
      />
      <rect
        x="71"
        y="28"
        width="11"
        height="5.5"
        rx="2.7"
        fill={PALETTE.berry}
        {...inkAvatar}
        transform="rotate(-28 76.5 31)"
      />
      <Shine d="M44 33 Q50 28.5 57 28.5" />
    </g>
  ),
};

/** A very short, neat buzz cut. */
export const hairBuzz: AvatarItemArt = {
  hair: ({ hair }: AvatarArtProps) => (
    <g>
      <path
        d="M35 55 C32 36 44 24 60 24 C76 24 88 36 85 55 C83 46 79 40 73 37 C66 39 54 39 47 37 C41 40 37 46 35 55 Z"
        fill={hair.base}
        {...inkAvatar}
      />
      <path
        d="M44 32 l2 1 M52 28 l1 2 M62 27 l1 2 M72 30 l2 1 M78 38 l1.5 1.5 M41 41 l1.5 1.5 M57 33 l2 1 M67 34 l2 1"
        fill="none"
        stroke={hair.shade}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Shine d="M45 31 Q52 27 60 27.5" />
    </g>
  ),
};
