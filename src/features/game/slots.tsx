import { useTranslation } from 'react-i18next';
import { AvatarSvg } from '@/art/avatar/AvatarSvg';
import { useProfile } from '@/data';
import { RewardEffects } from './effects/RewardEffects';
import { lookFromProfile } from './logic/looks';
import { DailyQuests } from './ui/DailyQuests';

/** Public components of the Game package, mounted by the shell and other packages. OWNER: Game. */

/**
 * Changing the adventurer from another package (onboarding): `equipAvatar(slot, itemId)` puts
 * on an owned item (starter items are owned by everyone) and `setDisplayName(name)` saves the
 * name. Both validate against the Game catalog.
 */
export { equipAvatar, setDisplayName } from './logic/looks';

/** The player's real avatar, round, at any size (header badge). */
export function AvatarBadge({ size = 40 }: { size?: number }) {
  const { t } = useTranslation('common');
  const profile = useProfile();
  return (
    <span data-testid="avatar-badge" data-look={JSON.stringify(profile?.avatar ?? null)}>
      <AvatarSvg
        variant="portrait"
        size={size}
        title={t('header.avatar')}
        look={lookFromProfile(profile?.avatar)}
      />
    </span>
  );
}

/** Today's three daily quests (plan section 6). Rendered on the Today board. */
export function DailyQuestsSlot() {
  return <DailyQuests />;
}

/** Reward feedback on every route, including focus mode. */
export function RewardEffectsSlot() {
  return <RewardEffects />;
}
