import type { FC } from 'react';

/** Avatar layers, back to front. See src/art/style.ts. */
export const AVATAR_LAYERS = ['back', 'body', 'neck', 'hair', 'eyes', 'hat'] as const;
export type AvatarLayer = (typeof AVATAR_LAYERS)[number];

export interface SkinSwatch {
  base: string;
  shade: string;
  blush: string;
}

export interface HairSwatch {
  base: string;
  shade: string;
  light: string;
}

/** What every avatar part receives: the wearer's skin and hair colors. */
export interface AvatarArtProps {
  skin: SkinSwatch;
  hair: HairSwatch;
}

/**
 * The art of one avatar item: one component per layer it draws on. Hair usually has `hair`
 * (front) and sometimes `back`; outfits draw `body` (and maybe `neck` for collars); hats
 * draw `hat`; glasses `eyes`; scarves `neck`.
 */
export type AvatarItemArt = Partial<Record<AvatarLayer, FC<AvatarArtProps>>>;
