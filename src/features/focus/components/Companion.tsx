import { useTranslation } from 'react-i18next';
import { AvatarBadge } from '@/features/game/slots';
import { cx } from '@/ui';

/**
 * The study companion: a small owl reading beside the player's avatar. Drawn in code; it
 * blinks now and then and breathes slowly (both stop with reduced motion). On a break it
 * puts the book down and dozes.
 */
export function Companion({
  resting = false,
  className,
}: {
  resting?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('focus');
  return (
    <div className={cx('flex items-end justify-center gap-1', className)}>
      <div className="shrink-0 rounded-full ring-2 ring-primary/20">
        <AvatarBadge size={52} />
      </div>
      <svg
        viewBox="0 0 64 64"
        width={58}
        height={58}
        role="img"
        aria-label={resting ? t('companion.resting') : t('companion.studying')}
        className="shrink-0"
      >
        <style>{`
          .ql-owl-body { transform-origin: 32px 56px; animation: ql-owl-breathe 4.8s ease-in-out infinite; }
          .ql-owl-lid { transform-origin: center; transform-box: fill-box; animation: ql-owl-blink 6s infinite; }
          @keyframes ql-owl-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.025); } }
          @keyframes ql-owl-blink { 0%,93%,100% { transform: scaleY(0); } 95%,98% { transform: scaleY(1); } }
        `}</style>
        {/* books */}
        <rect x="10" y="52" width="44" height="6" rx="1.5" fill="var(--ql-cat-sky)" />
        <rect x="13" y="47" width="38" height="5.5" rx="1.5" fill="var(--ql-cat-rose)" />
        <path d="M14 49.7h36" stroke="var(--ql-surface)" strokeWidth="0.8" opacity="0.7" />
        <g className="ql-owl-body">
          {/* body */}
          <path d="M18 46c-2-10 0-24 14-26 14 2 16 16 14 26z" fill="var(--ql-cat-clay)" />
          <path d="M24 46c-1-7 1-15 8-16 7 1 9 9 8 16z" fill="var(--ql-surface)" opacity="0.85" />
          {/* ear tufts */}
          <path d="M20 24l1-7 6 5zM44 24l-1-7-6 5z" fill="var(--ql-cat-clay)" />
          {/* eyes */}
          <circle cx="26" cy="28" r="5.2" fill="var(--ql-surface)" />
          <circle cx="38" cy="28" r="5.2" fill="var(--ql-surface)" />
          {resting ? (
            <>
              <path
                d="M22.5 28.5q3.5 2.5 7 0"
                stroke="#3d2e25"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M34.5 28.5q3.5 2.5 7 0"
                stroke="#3d2e25"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <circle cx="26.5" cy="29.5" r="2.2" fill="#3d2e25" />
              <circle cx="38.5" cy="29.5" r="2.2" fill="#3d2e25" />
              <rect
                className="ql-owl-lid"
                x="20.8"
                y="22.8"
                width="10.4"
                height="10.4"
                rx="5.2"
                fill="var(--ql-cat-clay)"
              />
              <rect
                className="ql-owl-lid"
                x="32.8"
                y="22.8"
                width="10.4"
                height="10.4"
                rx="5.2"
                fill="var(--ql-cat-clay)"
              />
            </>
          )}
          {/* beak */}
          <path d="M30.5 32.5h3L32 35z" fill="var(--ql-gold)" />
        </g>
        {resting ? (
          <text x="48" y="16" fontSize="8" fill="var(--ql-text-muted)" fontFamily="sans-serif">
            z
          </text>
        ) : (
          /* open book held up */
          <g>
            <path
              d="M19 44q6.5-3 13 0v-8q-6.5-3-13 0z"
              fill="var(--ql-surface-2)"
              stroke="var(--ql-border-strong)"
              strokeWidth="0.8"
            />
            <path
              d="M45 44q-6.5-3-13 0v-8q6.5-3 13 0z"
              fill="var(--ql-surface-2)"
              stroke="var(--ql-border-strong)"
              strokeWidth="0.8"
            />
            <path
              d="M22 39q4-1.5 8 0M22 41.5q4-1.5 8 0M34 39q4-1.5 8 0"
              stroke="var(--ql-text-faint)"
              strokeWidth="0.6"
              fill="none"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
