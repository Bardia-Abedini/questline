import { accGlasses, accLeafEarrings, accScarf } from './accessories';
import { hairBun, hairCurly, hairLong, hairShort } from './hair';
import { hatBeanie, hatFlowerCrown, hatWizard } from './hats';
import { outfitHoodie, outfitOveralls, outfitStarRobe, outfitTunic } from './outfits';
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
  outfit_tunic: outfitTunic,
  outfit_hoodie: outfitHoodie,
  outfit_overalls: outfitOveralls,
  outfit_star_robe: outfitStarRobe,
  hat_beanie: hatBeanie,
  hat_wizard: hatWizard,
  hat_flower_crown: hatFlowerCrown,
  acc_glasses: accGlasses,
  acc_scarf: accScarf,
  acc_leaf_earrings: accLeafEarrings,
};
