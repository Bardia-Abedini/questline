import { useTranslation } from 'react-i18next';

/** Public components of the Game package, mounted by the shell and other packages. OWNER: Game. */

/**
 * The player's avatar, small and round, for the header. Placeholder: a friendly face.
 * Keep it square and size it with the `size` prop (px).
 */
export function AvatarBadge({ size = 40 }: { size?: number }) {
  const { t } = useTranslation('common');
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={t('header.avatar')}>
      <circle cx="24" cy="24" r="24" fill="var(--ql-primary-soft)" />
      <path d="M10 44c2-8 8-12 14-12s12 4 14 12" fill="var(--ql-accent)" />
      <circle cx="24" cy="21" r="10" fill="#f3c9a4" />
      <path d="M14 20c0-7 5-11 10-11s10 4 10 11c-3-3-7-4-10-4s-7 1-10 4Z" fill="#8a5a3b" />
      <circle cx="20.5" cy="22" r="1.3" fill="#3d2e25" />
      <circle cx="27.5" cy="22" r="1.3" fill="#3d2e25" />
      <path
        d="M21 26c1.8 1.4 4.2 1.4 6 0"
        stroke="#3d2e25"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="18.5" cy="25" r="1.6" fill="#e99a8a" opacity="0.6" />
      <circle cx="29.5" cy="25" r="1.6" fill="#e99a8a" opacity="0.6" />
    </svg>
  );
}

/** Today's three daily quests (plan section 6). Rendered on the Today board. */
export function DailyQuestsSlot() {
  return null;
}

/**
 * Reward feedback: floating numbers, sounds, level-up celebration (respecting reduced
 * motion and the sound setting). Rendered once at the app root; listen to `reward.granted`,
 * `level.up` and `loot.dropped`.
 */
export function RewardEffectsSlot() {
  return null;
}
