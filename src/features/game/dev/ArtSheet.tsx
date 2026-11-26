import { AvatarSvg, type AvatarLook } from '@/art/avatar/AvatarSvg';
import { AVATAR_ART } from '@/art/avatar/registry';
import { HAIR_SWATCHES, SKIN_SWATCHES } from '@/art/avatar/swatches';
import { ExteriorScene } from '@/art/cottage/ExteriorScene';
import { DECOR_ART, FLOOR_ART, PET_ART, WALLPAPER_ART } from '@/art/cottage/registry';
import { RoomScene, type RoomLook } from '@/art/cottage/RoomScene';
import { DECOR_SLOTS, SLOT_BOXES, type DecorSlot } from '@/art/cottage/slots';

const ROOM_A: RoomLook = {
  slots: {
    bunting: 'bunting_pennants',
    wall_left: 'wall_left_landscape',
    wall_right: 'wall_right_shelf',
    window: 'window_plant',
    lamp: 'lamp_lantern',
    corner: 'corner_plant',
    table: 'table_tea',
    seat: 'seat_armchair',
    rug: 'rug_round',
    floor_front: 'floor_front_yarn',
  },
  pet: 'pet_cat',
  wallpaper: 'wallpaper_cream',
  floor: 'floor_planks',
};
const ROOM_B: RoomLook = {
  slots: {
    bunting: 'bunting_fairy_lights',
    wall_left: 'wall_left_mirror',
    wall_right: 'wall_right_clock',
    window: 'window_candles',
    lamp: 'lamp_paper_globe',
    corner: 'corner_floor_lamp',
    table: 'table_bookcase',
    seat: 'seat_beanbag',
    rug: 'rug_striped',
    floor_front: 'floor_front_books',
  },
  pet: 'pet_bird',
  wallpaper: 'wallpaper_sage_stripes',
  floor: 'floor_checker',
};

function slotOf(id: string): DecorSlot {
  return DECOR_SLOTS.find((s) => id.startsWith(s)) ?? 'rug';
}

function ItemTile({ id }: { id: string }) {
  const Art = DECOR_ART[id]!;
  const b = SLOT_BOXES[slotOf(id)];
  const pad = 14;
  return (
    <figure className="flex flex-col items-center gap-1 rounded-md bg-surface p-2">
      <svg viewBox={`${-pad} ${-pad} ${b.w + pad * 2} ${b.h + pad * 2}`} width="140" height="110">
        <rect
          x="0"
          y="0"
          width={b.w}
          height={b.h}
          fill="none"
          stroke="#ccc"
          strokeDasharray="2 2"
        />
        <Art />
      </svg>
      <figcaption className="text-xs">{id}</figcaption>
    </figure>
  );
}

const BASE: AvatarLook = {
  skin: 'skin_3',
  hair: 'hair_short',
  hair_color: 'chestnut',
  outfit: 'outfit_tunic',
  hat: null,
  accessory: null,
};

function lookWith(id: string): AvatarLook {
  if (id.startsWith('hair_')) return { ...BASE, hair: id };
  if (id.startsWith('outfit_')) return { ...BASE, outfit: id };
  if (id.startsWith('hat_')) return { ...BASE, hat: id };
  return { ...BASE, accessory: id };
}

const ROOM_C: RoomLook = {
  slots: {
    bunting: 'bunting_pennants',
    wall_left: 'wall_left_pressed_flowers',
    wall_right: 'wall_right_plant_hanger',
    window: 'window_goldfish_bowl',
    lamp: 'lamp_lantern',
    corner: 'corner_umbrella_stand',
    table: 'table_writing_desk',
    seat: 'seat_rocking_chair',
    rug: 'rug_round',
    floor_front: 'floor_front_cushions',
  },
  pet: 'pet_hedgehog',
  wallpaper: 'wallpaper_cream',
  floor: 'floor_planks',
};

const HAIRS = Object.keys(AVATAR_ART).filter((id) => id.startsWith('hair_'));
const HATS = Object.keys(AVATAR_ART).filter((id) => id.startsWith('hat_'));
const OUTFITS = Object.keys(AVATAR_ART).filter((id) => id.startsWith('outfit_'));
const ACCS = Object.keys(AVATAR_ART).filter((id) => id.startsWith('acc_'));

/** Every hair with every hat, outfit and accessory (review of layering). */
function Combos() {
  const rows: Array<[string, AvatarLook[]]> = HAIRS.map((hair) => [
    hair,
    [
      ...HATS.map((hat) => ({ ...BASE, hair, hat })),
      ...OUTFITS.map((outfit) => ({ ...BASE, hair, outfit })),
      ...ACCS.map((accessory) => ({ ...BASE, hair, accessory })),
    ],
  ]);
  return (
    <div className="flex flex-col gap-1" data-testid="combos">
      <p className="text-xs">columns: {[...HATS, ...OUTFITS, ...ACCS].join(', ')}</p>
      {rows.map(([hair, looks]) => (
        <div key={hair} className="flex items-center gap-1">
          <span className="w-24 shrink-0 text-xs">{hair}</span>
          {looks.map((look, i) => (
            <AvatarSvg key={i} look={look} size={64} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Panel({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <section data-theme={theme} className="flex flex-col gap-4 bg-bg p-4 text-text">
      <h2 className="text-lg font-bold">{theme}</h2>
      <div className="flex flex-wrap gap-3">
        {Object.keys(AVATAR_ART).map((id) => (
          <figure key={id} className="flex flex-col items-center gap-1 rounded-md bg-surface p-2">
            <AvatarSvg look={lookWith(id)} size={140} />
            <figcaption className="text-xs">{id}</figcaption>
          </figure>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {Object.keys(SKIN_SWATCHES).map((skin, i) => (
          <AvatarSvg
            key={skin}
            variant="portrait"
            size={72}
            look={{ ...BASE, skin, hair_color: Object.keys(HAIR_SWATCHES)[i] ?? 'chestnut' }}
          />
        ))}
        {[24, 38, 56].map((s) => (
          <AvatarSvg key={s} variant="portrait" size={s} look={{ ...BASE, hat: 'hat_wizard' }} />
        ))}
      </div>
      {theme === 'light' && <Combos />}
      <div className="grid gap-3 md:grid-cols-2">
        <RoomScene look={ROOM_A} className="w-full rounded-lg" />
        <RoomScene
          look={{ ...ROOM_B, pet: 'pet_turtle', wallpaper: 'wallpaper_starry' }}
          className="w-full rounded-lg"
        />
        <RoomScene look={ROOM_B} highlight="lamp" className="w-full rounded-lg" />
        <RoomScene look={ROOM_C} className="w-full rounded-lg" />
        <RoomScene
          look={{ ...ROOM_C, pet: 'pet_cat', slots: { ...ROOM_C.slots, rug: 'rug_striped' } }}
          className="w-full rounded-lg"
        />
        <RoomScene
          look={{ slots: {}, pet: null, wallpaper: null, floor: null }}
          className="w-full rounded-lg"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {Object.keys(DECOR_ART).map((id) => (
          <ItemTile key={id} id={id} />
        ))}
        {Object.entries(PET_ART).map(([id, Pet]) => (
          <figure key={id} className="flex flex-col items-center gap-1 rounded-md bg-surface p-2">
            <svg viewBox="-8 -12 72 66" width="140" height="110">
              <Pet />
            </svg>
            <figcaption className="text-xs">{id}</figcaption>
          </figure>
        ))}
        <span className="text-xs">
          {[...Object.keys(WALLPAPER_ART), ...Object.keys(FLOOR_ART)].join(', ')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6].map((tier) => (
          <ExteriorScene key={tier} tier={tier} className="w-full rounded-lg" />
        ))}
      </div>
    </section>
  );
}

/** Hidden page (/dev/art) showing every piece of Game art, for review. */
export default function ArtSheet() {
  return (
    <main id="main" className="flex flex-col">
      <Panel theme="light" />
      <Panel theme="dark" />
    </main>
  );
}
