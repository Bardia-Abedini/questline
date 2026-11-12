/**
 * Equipping: the avatar look, cottage decorations and the title, stored on `profile`.
 */
import type { AvatarLook } from '@/art/avatar/AvatarSvg';
import type { RoomLook } from '@/art/cottage/RoomScene';
import { DECOR_SLOTS, type DecorSlot } from '@/art/cottage/slots';
import { getProfile, updateProfile, type AvatarConfig, type CottageConfig } from '@/data';
import {
  cosmeticById,
  DEFAULT_FLOOR,
  DEFAULT_ROOM,
  DEFAULT_WALLPAPER,
  type AvatarSlot,
  type CottageSlot,
} from '../catalog/cosmetics';
import { ownedCosmeticIds } from './shop';

export const DEFAULT_LOOK: AvatarLook = {
  skin: 'skin_3',
  hair: 'hair_short',
  hair_color: 'chestnut',
  outfit: 'outfit_tunic',
  hat: null,
  accessory: null,
};

/** The room as drawn: unset slots show the starter decoration, `null` means emptied. */
export function resolveRoom(cottage: CottageConfig | undefined): RoomLook {
  const slots: Partial<Record<DecorSlot, string | null>> = {};
  for (const slot of DECOR_SLOTS) {
    const value = cottage?.slots[slot];
    slots[slot] = value === undefined ? DEFAULT_ROOM[slot] : value;
  }
  return {
    slots,
    pet: cottage?.pet ?? null,
    wallpaper: cottage?.wallpaper ?? DEFAULT_WALLPAPER,
    floor: cottage?.floor ?? DEFAULT_FLOOR,
  };
}

/** How many decoration slots differ from the starter room and are filled. */
export function decorationsPlaced(cottage: CottageConfig | undefined): number {
  const room = resolveRoom(cottage);
  let n = DECOR_SLOTS.filter((s) => room.slots[s] && room.slots[s] !== DEFAULT_ROOM[s]).length;
  if (room.pet) n++;
  if (room.wallpaper !== DEFAULT_WALLPAPER) n++;
  if (room.floor !== DEFAULT_FLOOR) n++;
  return n;
}

export function lookFromProfile(avatar: AvatarConfig | undefined): AvatarLook {
  return avatar ? { ...avatar } : DEFAULT_LOOK;
}

/** Puts on an owned avatar item (or takes off a hat/accessory with null). */
export async function equipAvatar(slot: AvatarSlot, itemId: string | null): Promise<void> {
  if (itemId !== null) {
    const item = cosmeticById(itemId);
    if (!item || item.slot !== slot) throw new RangeError(`${itemId} is not a ${slot}`);
    if (!(await ownedCosmeticIds()).has(itemId)) throw new RangeError('Not owned');
  } else if (slot === 'skin' || slot === 'hair_color') {
    throw new RangeError(`${slot} cannot be empty`);
  }
  const profile = await getProfile();
  await updateProfile({ avatar: { ...profile.avatar, [slot]: itemId } });
}

/** Places an owned decoration (or clears the slot with null). */
export async function placeCottageItem(slot: CottageSlot, itemId: string | null): Promise<void> {
  if (itemId !== null) {
    const item = cosmeticById(itemId);
    if (!item || item.slot !== slot) throw new RangeError(`${itemId} does not fit ${slot}`);
    if (!(await ownedCosmeticIds()).has(itemId)) throw new RangeError('Not owned');
  }
  const profile = await getProfile();
  const cottage: CottageConfig = { ...profile.cottage, slots: { ...profile.cottage.slots } };
  if (slot === 'pet') cottage.pet = itemId;
  else if (slot === 'wallpaper') cottage.wallpaper = itemId ?? DEFAULT_WALLPAPER;
  else if (slot === 'floor') cottage.floor = itemId ?? DEFAULT_FLOOR;
  else cottage.slots[slot] = itemId;
  await updateProfile({ cottage });
}

/** Equips any owned cosmetic in its own slot. */
export async function equipCosmetic(itemId: string): Promise<void> {
  const item = cosmeticById(itemId);
  if (!item) throw new RangeError(`Unknown item ${itemId}`);
  if (item.area === 'avatar') await equipAvatar(item.slot as AvatarSlot, itemId);
  else await placeCottageItem(item.slot as CottageSlot, itemId);
}

export async function setTitle(titleId: string | null): Promise<void> {
  await updateProfile({ title_id: titleId });
}

export async function setDisplayName(name: string): Promise<void> {
  await updateProfile({ display_name: name.trim().slice(0, 40) });
}

/** Whether a cosmetic is currently worn or placed. */
export function isEquipped(itemId: string, look: AvatarLook, room: RoomLook): boolean {
  const item = cosmeticById(itemId);
  if (!item) return false;
  if (item.area === 'avatar') return look[item.slot as keyof AvatarLook] === itemId;
  if (item.slot === 'pet') return room.pet === itemId;
  if (item.slot === 'wallpaper') return room.wallpaper === itemId;
  if (item.slot === 'floor') return room.floor === itemId;
  return room.slots[item.slot as DecorSlot] === itemId;
}
