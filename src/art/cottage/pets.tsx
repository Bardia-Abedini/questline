import { INK, inkRoom, PALETTE } from '../style';

/**
 * Pets (box 56 x 46, sitting on the bottom edge). Always content and cozy: they never get
 * sad, hungry or sick. Each has a gentle idle motion (CSS classes from art.css).
 */

/** A sleepy ginger cat curled into a loaf, tail swaying. */
export function PetCat() {
  return (
    <g>
      <path
        className="qa-sway"
        d="M46 40 C56 38 56 26 50 22"
        fill="none"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        className="qa-sway"
        d="M46 40 C56 38 56 26 50 22"
        fill="none"
        stroke={PALETTE.peach}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g className="qa-breathe">
        <path d="M6 44 C4 30 14 22 30 22 C44 22 52 30 50 44 Z" fill={PALETTE.peach} {...inkRoom} />
        <path
          d="M30 24 L32 32 M38 25 L38 33 M45 30 L42 36"
          stroke={PALETTE.peachShade}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M8 18 L10 6 L18 13 Z M28 13 L34 5 L35 18 Z" fill={PALETTE.peach} {...inkRoom} />
        <path d="M11 11 L12 14 L15 13 Z M31 10 L32 15 L33 13 Z" fill={PALETTE.rose} />
        <ellipse cx="22" cy="24" rx="15" ry="12" fill={PALETTE.peach} {...inkRoom} />
        <path
          d="M14 24 Q16.5 26.5 19 24 M25 24 Q27.5 26.5 30 24"
          fill="none"
          stroke={INK}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M21 28 L23 28 L22 29.2 Z" fill={PALETTE.berry} />
        <ellipse cx="13" cy="29" rx="2.6" ry="1.6" fill={PALETTE.rose} opacity="0.7" />
        <ellipse cx="31" cy="29" rx="2.6" ry="1.6" fill={PALETTE.rose} opacity="0.7" />
        <path
          d="M12 44 C12 40 18 39 20 42 M24 42 C26 39 32 40 32 44"
          fill={PALETTE.cream}
          {...inkRoom}
          strokeWidth="1.2"
        />
      </g>
    </g>
  );
}

/** A round little sky-blue bird that bobs and blinks. */
export function PetBird() {
  return (
    <g className="qa-bob">
      <path
        d="M22 40 L20 45 M32 40 L34 45"
        stroke={PALETTE.honeyShade}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M10 26 C2 26 0 34 6 36" fill={PALETTE.skyShade} {...inkRoom} />
      <ellipse cx="27" cy="27" rx="18" ry="16" fill={PALETTE.sky} {...inkRoom} />
      <ellipse cx="29" cy="33" rx="10" ry="7" fill={PALETTE.cream} />
      <path
        d="M14 28 C12 36 20 40 24 34 C22 30 18 28 14 28 Z"
        fill={PALETTE.skyShade}
        {...inkRoom}
        strokeWidth="1.2"
      />
      <path
        d="M26 12 C26 8 30 6 32 9"
        fill="none"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g className="qa-blink">
        <ellipse cx="33" cy="22" rx="2" ry="2.4" fill={INK} />
        <circle cx="33.7" cy="21.2" r="0.7" fill="#fff" />
      </g>
      <path d="M40 24 L46 26 L40 28 Z" fill={PALETTE.honey} {...inkRoom} strokeWidth="1.2" />
      <ellipse cx="37" cy="29" rx="2.4" ry="1.5" fill={PALETTE.rose} opacity="0.75" />
    </g>
  );
}

/** A tiny turtle with a mossy shell and a flower on top. */
export function PetTurtle() {
  return (
    <g>
      <g fill={PALETTE.sage} {...inkRoom}>
        <ellipse cx="14" cy="42" rx="5" ry="3.5" />
        <ellipse cx="40" cy="42" rx="5" ry="3.5" />
      </g>
      <g className="qa-bob">
        <ellipse cx="48" cy="32" rx="7" ry="6.5" fill={PALETTE.sage} {...inkRoom} />
        <g className="qa-blink">
          <ellipse cx="50" cy="30.5" rx="1.4" ry="1.8" fill={INK} />
        </g>
        <path
          d="M49 35 Q51 36.5 53 35"
          fill="none"
          stroke={INK}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </g>
      <g className="qa-breathe">
        <path d="M6 40 C6 22 16 14 27 14 C38 14 46 22 46 40 Z" fill={PALETTE.moss} {...inkRoom} />
        <path
          d="M16 38 L19 26 L27 22 L35 26 L38 38"
          fill="none"
          stroke={PALETTE.mossShade}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M27 22 L27 14" stroke={PALETTE.mossShade} strokeWidth="1.5" />
        <path d="M4 40 L48 40" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M18 17 C20 13 24 12 26 14 C28 11 33 12 34 16" fill={PALETTE.leaf} />
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle
              key={a}
              cx={29 + Math.cos((a * Math.PI) / 180) * 2.4}
              cy={10 + Math.sin((a * Math.PI) / 180) * 2.4}
              r="2.4"
              fill={PALETTE.cream}
              stroke={INK}
              strokeWidth="0.8"
            />
          ))}
          <circle cx="29" cy="10" r="1.6" fill={PALETTE.honey} />
        </g>
      </g>
    </g>
  );
}
