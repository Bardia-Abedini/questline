import { INK } from '@/art/style';
import { Icon } from '@/ui';
import type { AchievementDef } from '../catalog/achievements';

const TIERS = {
  bronze: { ring: '#c8875a', face: '#f3d2b4', ribbon: '#d9637a' },
  silver: { ring: '#9aa3b5', face: '#e6eaf2', ribbon: '#6f8fc0' },
  gold: { ring: '#d6a032', face: '#fbe7a8', ribbon: '#7fa36a' },
} as const;

/** An achievement medallion. Locked badges are a soft, quiet outline (no guilt). */
export function Badge({
  def,
  unlocked,
  size = 56,
}: {
  def: AchievementDef;
  unlocked: boolean;
  size?: number;
}) {
  const c = TIERS[def.tier];
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden focusable="false">
        {unlocked ? (
          <>
            <path
              d="M22 40 L16 62 L24 57 L30 62 L32 42 Z"
              fill={c.ribbon}
              stroke="#4a3428"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M42 40 L48 62 L40 57 L34 62 L32 42 Z"
              fill={c.ribbon}
              stroke="#4a3428"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="28" r="24" fill={c.ring} stroke="#4a3428" strokeWidth="2" />
            <circle cx="32" cy="28" r="18" fill={c.face} stroke="#4a3428" strokeWidth="1.2" />
            <path
              d="M20 20 Q25 13 33 12"
              fill="none"
              stroke="#fff"
              strokeOpacity="0.6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          <circle
            cx="32"
            cy="28"
            r="23"
            fill="var(--ql-surface-2)"
            stroke="var(--ql-border-strong)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}
      </svg>
      <span
        className={
          unlocked
            ? 'absolute inset-x-0 flex justify-center'
            : 'absolute inset-x-0 flex justify-center text-faint'
        }
        style={{ color: unlocked ? INK : undefined, top: size * 0.27 }}
      >
        <Icon name={def.icon} size={Math.round(size * 0.34)} />
      </span>
    </span>
  );
}
