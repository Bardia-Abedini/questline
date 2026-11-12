import type { FC } from 'react';
import {
  BuntingFairyLights,
  BuntingPennants,
  CornerFloorLamp,
  CornerPlant,
  FloorBooks,
  FloorYarnBasket,
  LampLantern,
  LampPaperGlobe,
  RugRound,
  RugStriped,
  SeatArmchair,
  SeatBeanbag,
  TableBookcase,
  TableTea,
  WallLeftLandscape,
  WallLeftMirror,
  WallRightClock,
  WallRightShelf,
  WindowCandles,
  WindowPlant,
} from './decor';
import { PetBird, PetCat, PetTurtle } from './pets';
import { FloorChecker, FloorPlanks, WallCream, WallSageStripes, WallStarry } from './surfaces';

/**
 * Cottage art by item id. The Game catalogue refers to these ids; a test checks that every
 * catalogue item has art here. Decorations draw in their slot box (slots.ts), wallpapers and
 * floors fill the wall and floor, pets draw in PET_BOX.
 */
export const DECOR_ART: Readonly<Record<string, FC>> = {
  bunting_pennants: BuntingPennants,
  bunting_fairy_lights: BuntingFairyLights,
  wall_left_landscape: WallLeftLandscape,
  wall_left_mirror: WallLeftMirror,
  wall_right_shelf: WallRightShelf,
  wall_right_clock: WallRightClock,
  window_plant: WindowPlant,
  window_candles: WindowCandles,
  lamp_lantern: LampLantern,
  lamp_paper_globe: LampPaperGlobe,
  corner_plant: CornerPlant,
  corner_floor_lamp: CornerFloorLamp,
  table_tea: TableTea,
  table_bookcase: TableBookcase,
  seat_armchair: SeatArmchair,
  seat_beanbag: SeatBeanbag,
  rug_round: RugRound,
  rug_striped: RugStriped,
  floor_front_books: FloorBooks,
  floor_front_yarn: FloorYarnBasket,
};

export const WALLPAPER_ART: Readonly<Record<string, FC>> = {
  wallpaper_cream: WallCream,
  wallpaper_sage_stripes: WallSageStripes,
  wallpaper_starry: WallStarry,
};

export const FLOOR_ART: Readonly<Record<string, FC>> = {
  floor_planks: FloorPlanks,
  floor_checker: FloorChecker,
};

export const PET_ART: Readonly<Record<string, FC>> = {
  pet_cat: PetCat,
  pet_bird: PetBird,
  pet_turtle: PetTurtle,
};
