import type { FC } from 'react';
import { AvatarSvg, type AvatarLook } from '@/art/avatar/AvatarSvg';
import { HAIR_SWATCHES } from '@/art/avatar/swatches';
import { DECOR_ART, FLOOR_ART, PET_ART, WALLPAPER_ART } from '@/art/cottage/registry';
import { SLOT_BOXES } from '@/art/cottage/slots';
import { cosmeticById, isDecorSlot } from '../catalog/cosmetics';
import { DEFAULT_LOOK } from '../logic/looks';

/** Thumbnail of any cosmetic, square, for shop cards, pickers and celebrations. */
export function ItemArt({
  itemId,
  size = 64,
  wearer = DEFAULT_LOOK,
}: {
  itemId: string;
  size?: number;
  /** For avatar items: who wears it in the thumbnail. */
  wearer?: AvatarLook;
}) {
  const item = cosmeticById(itemId);
  if (!item) return null;
  const box = (vb: string, Art: FC | undefined) => (
    <svg viewBox={vb} width={size} height={size} aria-hidden focusable="false">
      {Art && <Art />}
    </svg>
  );

  switch (item.slot) {
    case 'hair_color': {
      const c = HAIR_SWATCHES[item.id]!;
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden focusable="false">
          <circle cx="32" cy="32" r="24" fill={c.base} stroke="#4a3428" strokeWidth="2" />
          <path
            d="M20 26 Q28 16 40 18"
            fill="none"
            stroke={c.light}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      );
    }
    case 'skin':
    case 'hair':
    case 'outfit':
    case 'hat':
    case 'accessory':
      return (
        <AvatarSvg
          size={size}
          variant={item.slot === 'outfit' ? 'bust' : 'portrait'}
          look={{ ...wearer, [item.slot]: item.id }}
        />
      );
    case 'wallpaper':
      return box('100 40 120 120', WALLPAPER_ART[item.id]);
    case 'floor':
      return box('120 166 80 80', FLOOR_ART[item.id]);
    case 'pet':
      return box('-6 -10 68 68', PET_ART[item.id]);
    default: {
      if (!isDecorSlot(item.slot)) return null;
      if (item.slot === 'bunting') return box('4 -8 96 64', DECOR_ART[item.id]);
      const b = SLOT_BOXES[item.slot];
      const side = Math.max(b.w, b.h) + 16;
      const x = b.w / 2 - side / 2;
      const y = b.h / 2 - side / 2;
      return box(`${x} ${y} ${side} ${side}`, DECOR_ART[item.id]);
    }
  }
}
