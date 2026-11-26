import type { HairSwatch, SkinSwatch } from './types';

/** Skin tones. Ids are stored in `profile.avatar.skin`. All free. */
export const SKIN_SWATCHES: Readonly<Record<string, SkinSwatch>> = {
  skin_1: { base: '#fde6d3', shade: '#efcbb0', blush: '#f4a6a0' },
  skin_2: { base: '#f6d0ae', shade: '#e6b48c', blush: '#ee9a8c' },
  skin_3: { base: '#e9b48a', shade: '#d3966b', blush: '#e48874' },
  skin_4: { base: '#c98c63', shade: '#ad714b', blush: '#d0715c' },
  skin_5: { base: '#9a6544', shade: '#7f5034', blush: '#b85d4c' },
  skin_6: { base: '#6b4430', shade: '#553424', blush: '#9a4c3f' },
};

/** Hair colors. Ids are stored in `profile.avatar.hair_color`. All free. */
export const HAIR_SWATCHES: Readonly<Record<string, HairSwatch>> = {
  chestnut: { base: '#8a5a3b', shade: '#6d442b', light: '#a8714d' },
  espresso: { base: '#3e2c27', shade: '#2b1e1a', light: '#5a423a' },
  honey: { base: '#e0b25e', shade: '#c4934a', light: '#f0cd85' },
  copper: { base: '#bf5f35', shade: '#9c4a27', light: '#d97c50' },
  lavender: { base: '#a48ad0', shade: '#8670b4', light: '#bea8e2' },
  silver: { base: '#cfc9c2', shade: '#b0a9a1', light: '#e6e1db' },
};

export const DEFAULT_SKIN = 'skin_3';
export const DEFAULT_HAIR_COLOR = 'chestnut';

export function skinSwatch(id: string | null | undefined): SkinSwatch {
  return SKIN_SWATCHES[id ?? ''] ?? SKIN_SWATCHES[DEFAULT_SKIN]!;
}

export function hairSwatch(id: string | null | undefined): HairSwatch {
  return HAIR_SWATCHES[id ?? ''] ?? HAIR_SWATCHES[DEFAULT_HAIR_COLOR]!;
}
