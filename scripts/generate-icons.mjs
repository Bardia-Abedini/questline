// Renders public/favicon.svg to the PNG sizes the PWA manifest and iOS need.
// Run with `npm run icons` after changing the SVG. Requires the `sharp` dev dependency.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));
const out = (p) => new URL(`../public/${p}`, import.meta.url).pathname;

for (const size of [192, 512]) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(out(`icons/icon-${size}.png`));
}
await sharp(svg, { density: 384 }).resize(180, 180).png().toFile(out('apple-touch-icon.png'));

// Maskable: full-bleed background with the art inside the 80% safe zone.
const inner = await sharp(svg, { density: 384 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#c8643a' } })
  .composite([{ input: inner, top: 56, left: 56 }])
  .png()
  .toFile(out('icons/icon-maskable-512.png'));
console.log('icons written');
