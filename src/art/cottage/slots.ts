/**
 * The cottage room (viewBox 0 0 360 240). Each decoration slot is a box in scene
 * coordinates; an item for that slot draws in local coordinates 0..w by 0..h (floor items
 * stand on the bottom edge, wall items are centred). Slots are drawn in this order, so
 * later slots overlap earlier ones.
 *
 * `wallpaper` and `floor` are not boxes: they fill the wall (0,0)-(360,170) and the floor
 * (0,170)-(360,240) and are stored in `profile.cottage.wallpaper` / `.floor`.
 */
export interface SlotBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DECOR_SLOTS = [
  'bunting',
  'wall_left',
  'wall_right',
  'window',
  'lamp',
  'corner',
  'table',
  'seat',
  'rug',
  'floor_front',
] as const;
export type DecorSlot = (typeof DECOR_SLOTS)[number];

export const SLOT_BOXES: Readonly<Record<DecorSlot, SlotBox>> = {
  bunting: { x: 24, y: 10, w: 312, h: 30 },
  wall_left: { x: 40, y: 50, w: 64, h: 56 },
  wall_right: { x: 262, y: 48, w: 66, h: 60 },
  window: { x: 146, y: 86, w: 68, h: 28 },
  lamp: { x: 226, y: 8, w: 36, h: 62 },
  corner: { x: 4, y: 94, w: 44, h: 94 },
  table: { x: 244, y: 112, w: 92, h: 88 },
  seat: { x: 30, y: 118, w: 100, h: 86 },
  rug: { x: 104, y: 192, w: 152, h: 38 },
  floor_front: { x: 290, y: 196, w: 54, h: 38 },
};

/** Where the pet sits (on the rug). */
export const PET_BOX: SlotBox = { x: 152, y: 178, w: 56, h: 46 };

export const ROOM_VIEWBOX = { w: 360, h: 240 } as const;
export const WALL_BOTTOM = 170;
