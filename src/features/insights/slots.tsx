/**
 * Energy check and "What should I do now?" (plan sections 10 and 13). OWNER: Finish package.
 * Rendered on the Today board.
 */
import { WeeklyRecapOffer } from '@/features/stats/slots';
import { EnergyCheck } from './EnergyCheck';
import { WhatNow } from './WhatNow';

/** One-tap energy (low / medium / high); remembered for a few hours, changeable any time. */
export function EnergyCheckSlot() {
  return <EnergyCheck />;
}

/**
 * The "What should I do now?" button and its pick. Also hosts the once-a-week recap offer
 * at the top of the Today board (it disappears when dismissed).
 */
export function WhatNowSlot() {
  return (
    <>
      <WeeklyRecapOffer />
      <WhatNow />
    </>
  );
}

export { useCurrentEnergy } from './energy';
