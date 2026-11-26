/**
 * Questline art style guide. Every avatar, cottage and item drawing follows these rules so
 * the whole game reads as one soft storybook world. All art is original, drawn in code as
 * inline SVG; no image files.
 *
 * LOOK
 * - Soft storybook: rounded shapes, no sharp corners (strokeLinejoin/strokeLinecap "round"),
 *   chunky friendly proportions, gentle colors. Nothing scary, sad, sick or aggressive.
 * - Every shape gets the INK outline (see STROKE) except tiny details (sparkles, blush,
 *   highlights, stitches) which have no outline.
 * - Shading: at most one darker "shade" shape per part (same hue, darker), placed on the
 *   lower or far side. Light comes from the top start corner.
 * - Highlight: at most one small HIGHLIGHT shape (white at 35% opacity) per part.
 * - Colors: pick from PALETTE below. Use 2 or 3 colors per item plus INK. No gradients
 *   except the sky and lamp glow (already in the scenes).
 * - Theme: scene backgrounds (walls, sky, floor, glow) use the `--qa-*` CSS variables from
 *   src/art/art.css so they follow light (day) and dark (evening). Items themselves keep
 *   fixed colors so they look the same in both themes.
 * - Motion: only pets and a few glows move, through CSS classes in art.css (qa-breathe,
 *   qa-sway, qa-blink, qa-bob, qa-flicker). Reduced motion stops them automatically.
 *
 * AVATAR (bust portrait, viewBox 0 0 120 120, see AVATAR_ANCHORS)
 * - Head: ellipse centre (60, 52), rx 25, ry 26 (top y 26, chin y 78). Ears at x 35 / 85, y 56.
 * - Eyes at (51, 56) and (69, 56). Mouth around (60, 67). Neck x 52..68, y 70..92.
 * - Torso / outfit: from y 86 to the bottom edge 120, shoulders out to x 16..104.
 * - Hair front sits on the head between y 20 and ~60 and must leave the eyes (y 50..62)
 *   visible. Long hair adds a `back` layer behind the head.
 * - Hats sit with their brim around y 30..38 and may rise to y 0.
 * - Glasses: centred on the eyes. Neck items (scarves): y 74..96.
 * - Layer order (back to front): back, skin (neck + shoulders), body (outfit), neck,
 *   head (skin), face, hair (front), eyes (glasses), hat.
 *
 * COTTAGE (room viewBox 0 0 360 240, see src/art/cottage/slots.ts)
 * - Every decoration slot has a box (x, y, w, h). An item draws in LOCAL coordinates
 *   0..w by 0..h, standing on the bottom edge (floor items) or centred (wall items).
 * - Stroke width 1.5 in the room (the scene is drawn three times bigger than the avatar).
 *
 * PETS: draw inside their slot box, sitting on the bottom edge, about 44 x 36. Give them a
 * `qa-breathe` body group and one small idle detail (tail sway, blink, bob). Pets are
 * always content: closed happy eyes or bright round eyes, small smile, never sad or sick.
 */

/** Outline color for every shape (a warm dark brown, never pure black). */
export const INK = '#4a3428';

/** Outline widths. */
export const STROKE = {
  /** Avatar parts (viewBox 120). */
  avatar: 2,
  /** Room and exterior items (viewBox 360 x 240). */
  room: 1.5,
  /** Fine details (stitches, wood grain). */
  detail: 1,
} as const;

/** White at this opacity for highlights. */
export const HIGHLIGHT_OPACITY = 0.35;

/** Shared outline props for avatar parts. */
export const inkAvatar = {
  stroke: INK,
  strokeWidth: STROKE.avatar,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

/** Shared outline props for room items. */
export const inkRoom = {
  stroke: INK,
  strokeWidth: STROKE.room,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

/**
 * The palette. Every color in an item comes from here (base / shade pairs). Names describe
 * the color, so any item may use any of them.
 */
export const PALETTE = {
  cream: '#fbf1dd',
  creamShade: '#ecdcbc',
  oat: '#e8d3ad',
  oatShade: '#d3b98c',
  wood: '#b07a4f',
  woodShade: '#8d5b37',
  woodLight: '#d2a273',
  bark: '#7a5236',
  moss: '#7fa36a',
  mossShade: '#5f8450',
  sage: '#a9c49a',
  sageShade: '#8aa97c',
  leaf: '#5f9a5a',
  leafShade: '#467a45',
  sky: '#8fc3e3',
  skyShade: '#6aa6cb',
  denim: '#6f8fc0',
  denimShade: '#5574a6',
  berry: '#d9637a',
  berryShade: '#b44a62',
  rose: '#f0a3b2',
  roseShade: '#d9849a',
  peach: '#f6bf94',
  peachShade: '#e19f72',
  rust: '#c8693e',
  rustShade: '#a6522c',
  honey: '#f2c14e',
  honeyShade: '#d6a032',
  plum: '#8b6bb8',
  plumShade: '#6d4f9a',
  lilac: '#c4b0e6',
  lilacShade: '#a68fce',
  teal: '#5fb3ad',
  tealShade: '#43918b',
  stone: '#b9b2a8',
  stoneShade: '#958d82',
  slate: '#6b6f80',
  slateShade: '#545868',
  snow: '#ffffff',
  night: '#2d2a44',
} as const;

export type PaletteColor = keyof typeof PALETTE;

/** Key positions on the avatar canvas (viewBox 0 0 120 120). */
export const AVATAR_ANCHORS = {
  viewBox: '0 0 120 120',
  head: { cx: 60, cy: 52, rx: 25, ry: 26 },
  eyes: { y: 56, left: 51, right: 69 },
  mouth: { x: 60, y: 67 },
  ears: { y: 56, left: 35, right: 85 },
  neck: { x: 52, y: 70, w: 16, h: 22 },
  shoulders: { y: 86, left: 16, right: 104 },
  hatBrim: 34,
} as const;
