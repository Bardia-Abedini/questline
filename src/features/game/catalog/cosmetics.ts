import { AVATAR_ART } from '@/art/avatar/registry';
import { HAIR_SWATCHES, SKIN_SWATCHES } from '@/art/avatar/swatches';
import { DECOR_ART, FLOOR_ART, PET_ART, WALLPAPER_ART } from '@/art/cottage/registry';
import { DECOR_SLOTS, type DecorSlot } from '@/art/cottage/slots';

/**
 * The cosmetic catalogue: typed data, one entry per item. Art lives in src/art (looked up
 * by id); names are i18n keys `game:items.<id>` in both languages. A unit test checks ids
 * are unique, every item has art and both translations, and prices/levels are sane.
 *
 * Pricing: common 30-90 gold, uncommon 70-160, rare 200-320. Starter items are free and
 * owned by everyone from the start (no inventory row). Rare items can also drop on a quest
 * finish (registered with configureRewards in setup.ts) and can always be bought too, so
 * nothing is luck-only.
 */

export const AVATAR_SLOTS = ['skin', 'hair', 'hair_color', 'outfit', 'hat', 'accessory'] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];
export const COTTAGE_SLOTS = ['wallpaper', 'floor', ...DECOR_SLOTS, 'pet'] as const;
export type CottageSlot = (typeof COTTAGE_SLOTS)[number];
export type CosmeticSlot = AvatarSlot | CottageSlot;
export type Rarity = 'common' | 'uncommon' | 'rare';

export interface CosmeticItem {
  id: string;
  area: 'avatar' | 'cottage';
  slot: CosmeticSlot;
  /** i18n key in the `game` namespace. */
  nameKey: string;
  /** Gold. 0 for starter items. */
  price: number;
  /** Player level needed to buy it (1 = from the start). */
  unlockLevel: number;
  rarity: Rarity;
  /** Free and owned from the start. */
  starter: boolean;
}

type Entry = [id: string, slot: CosmeticSlot, price: number, level: number, rarity?: Rarity];

function build(area: CosmeticItem['area'], entries: Entry[]): CosmeticItem[] {
  return entries.map(([id, slot, price, unlockLevel, rarity = 'common']) => ({
    id,
    area,
    slot,
    nameKey: `items.${id}`,
    price,
    unlockLevel,
    rarity,
    starter: price === 0,
  }));
}

const AVATAR_ENTRIES: Entry[] = [
  ...Object.keys(SKIN_SWATCHES).map((id): Entry => [id, 'skin', 0, 1]),
  ...Object.keys(HAIR_SWATCHES).map((id): Entry => [id, 'hair_color', 0, 1]),
  ['hair_short', 'hair', 0, 1],
  ['hair_long', 'hair', 0, 1],
  ['hair_curly', 'hair', 40, 1],
  ['hair_bun', 'hair', 40, 2],
  ['hair_bob', 'hair', 40, 2],
  ['hair_ponytail', 'hair', 40, 2],
  ['hair_braids', 'hair', 50, 3],
  ['hair_buzz', 'hair', 35, 1],
  ['outfit_tunic', 'outfit', 0, 1],
  ['outfit_hoodie', 'outfit', 60, 2],
  ['outfit_overalls', 'outfit', 80, 3, 'uncommon'],
  ['outfit_knit_sweater', 'outfit', 70, 4],
  ['outfit_raincoat', 'outfit', 90, 5],
  ['outfit_star_robe', 'outfit', 240, 10, 'rare'],
  ['hat_beanie', 'hat', 50, 1],
  ['hat_beret', 'hat', 60, 3],
  ['hat_flower_crown', 'hat', 90, 5, 'uncommon'],
  ['hat_wizard', 'hat', 260, 15, 'rare'],
  ['acc_glasses', 'accessory', 35, 1],
  ['acc_scarf', 'accessory', 55, 3],
  ['acc_flower_hairclip', 'accessory', 45, 2],
  ['acc_leaf_earrings', 'accessory', 70, 5, 'uncommon'],
  ['acc_star_earrings', 'accessory', 80, 6, 'uncommon'],
];

const COTTAGE_ENTRIES: Entry[] = [
  ['wallpaper_cream', 'wallpaper', 0, 1],
  ['wallpaper_sage_stripes', 'wallpaper', 70, 3],
  ['wallpaper_starry', 'wallpaper', 220, 10, 'rare'],
  ['floor_planks', 'floor', 0, 1],
  ['floor_checker', 'floor', 90, 5, 'uncommon'],
  ['bunting_pennants', 'bunting', 30, 1],
  ['bunting_fairy_lights', 'bunting', 120, 5, 'uncommon'],
  ['wall_left_landscape', 'wall_left', 0, 1],
  ['wall_left_mirror', 'wall_left', 60, 2],
  ['wall_left_pressed_flowers', 'wall_left', 65, 3],
  ['wall_right_shelf', 'wall_right', 45, 1],
  ['wall_right_clock', 'wall_right', 80, 4],
  ['wall_right_plant_hanger', 'wall_right', 70, 3],
  ['window_plant', 'window', 0, 1],
  ['window_candles', 'window', 50, 2],
  ['window_goldfish_bowl', 'window', 80, 4],
  ['lamp_lantern', 'lamp', 0, 1],
  ['lamp_paper_globe', 'lamp', 60, 3],
  ['corner_plant', 'corner', 40, 1],
  ['corner_umbrella_stand', 'corner', 50, 2],
  ['corner_floor_lamp', 'corner', 90, 5, 'uncommon'],
  ['table_tea', 'table', 60, 2],
  ['table_writing_desk', 'table', 130, 8, 'uncommon'],
  ['table_bookcase', 'table', 150, 10, 'uncommon'],
  ['seat_armchair', 'seat', 0, 1],
  ['seat_beanbag', 'seat', 110, 5, 'uncommon'],
  ['seat_rocking_chair', 'seat', 120, 6, 'uncommon'],
  ['rug_round', 'rug', 0, 1],
  ['rug_striped', 'rug', 70, 3],
  ['floor_front_yarn', 'floor_front', 35, 1],
  ['floor_front_books', 'floor_front', 45, 2],
  ['floor_front_cushions', 'floor_front', 45, 3],
  ['pet_cat', 'pet', 120, 3, 'uncommon'],
  ['pet_bird', 'pet', 160, 5, 'uncommon'],
  ['pet_hedgehog', 'pet', 140, 4, 'uncommon'],
  ['pet_turtle', 'pet', 300, 15, 'rare'],
];

export const COSMETICS: readonly CosmeticItem[] = Object.freeze([
  ...build('avatar', AVATAR_ENTRIES),
  ...build('cottage', COTTAGE_ENTRIES),
]);

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string | null | undefined): CosmeticItem | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function cosmeticsForSlot(slot: CosmeticSlot): CosmeticItem[] {
  return COSMETICS.filter((c) => c.slot === slot);
}

export const STARTER_IDS: ReadonlySet<string> = new Set(
  COSMETICS.filter((c) => c.starter).map((c) => c.id),
);

/** Rare cosmetics that can drop when a quest is finished. */
export function rareItemIds(): string[] {
  return COSMETICS.filter((c) => c.rarity === 'rare').map((c) => c.id);
}

/** Items that become available exactly at this level (shown in the level-up celebration). */
export function itemsUnlockedAt(level: number): CosmeticItem[] {
  return COSMETICS.filter((c) => !c.starter && c.unlockLevel === level);
}

/** Whether the art registry can draw this item. */
export function hasArt(item: CosmeticItem): boolean {
  switch (item.slot) {
    case 'skin':
      return item.id in SKIN_SWATCHES;
    case 'hair_color':
      return item.id in HAIR_SWATCHES;
    case 'hair':
    case 'outfit':
    case 'hat':
    case 'accessory':
      return item.id in AVATAR_ART;
    case 'wallpaper':
      return item.id in WALLPAPER_ART;
    case 'floor':
      return item.id in FLOOR_ART;
    case 'pet':
      return item.id in PET_ART;
    default:
      return item.id in DECOR_ART;
  }
}

export function isDecorSlot(slot: CosmeticSlot): slot is DecorSlot {
  return (DECOR_SLOTS as readonly string[]).includes(slot);
}

/** What a new cottage shows before the player changes anything (starter items). */
export const DEFAULT_ROOM: Readonly<Record<DecorSlot, string | null>> = {
  bunting: null,
  wall_left: 'wall_left_landscape',
  wall_right: null,
  window: 'window_plant',
  lamp: 'lamp_lantern',
  corner: null,
  table: null,
  seat: 'seat_armchair',
  rug: 'rug_round',
  floor_front: null,
};
export const DEFAULT_WALLPAPER = 'wallpaper_cream';
export const DEFAULT_FLOOR = 'floor_planks';
