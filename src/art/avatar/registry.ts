import {
  accFlowerHairclip,
  accGlasses,
  accLeafEarrings,
  accScarf,
  accStarEarrings,
} from './accessories';
import {
  hairBob,
  hairBraids,
  hairBun,
  hairBuzz,
  hairCurly,
  hairLong,
  hairPonytail,
  hairShort,
} from './hair';
import { hatBeanie, hatBeret, hatFlowerCrown, hatWizard } from './hats';
import {
  outfitHoodie,
  outfitKnitSweater,
  outfitOveralls,
  outfitRaincoat,
  outfitStarRobe,
  outfitTunic,
} from './outfits';
import type { AvatarItemArt } from './types';

/**
 * Avatar art by item id. The Game catalogue (src/features/game/catalog) refers to these ids;
 * a test checks that every catalogue item has art here. Add new items here and in the
 * catalogue together.
 */
export const AVATAR_ART: Readonly<Record<string, AvatarItemArt>> = {
  hair_short: hairShort,
  hair_long: hairLong,
  hair_curly: hairCurly,
  hair_bun: hairBun,
  hair_bob: hairBob,
  hair_braids: hairBraids,
  hair_ponytail: hairPonytail,
  hair_buzz: hairBuzz,
  outfit_tunic: outfitTunic,
  outfit_hoodie: outfitHoodie,
  outfit_overalls: outfitOveralls,
  outfit_star_robe: outfitStarRobe,
  outfit_knit_sweater: outfitKnitSweater,
  outfit_raincoat: outfitRaincoat,
  hat_beanie: hatBeanie,
  hat_wizard: hatWizard,
  hat_flower_crown: hatFlowerCrown,
  hat_beret: hatBeret,
  acc_glasses: accGlasses,
  acc_scarf: accScarf,
  acc_leaf_earrings: accLeafEarrings,
  acc_star_earrings: accStarEarrings,
  acc_flower_hairclip: accFlowerHairclip,
};
