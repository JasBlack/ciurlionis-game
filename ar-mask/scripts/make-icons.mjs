// Makes the family's six icon files from the master drawing, public/favicon.svg:
//   favicon-32.png        tab icon, rounded tile with clear corners
//   favicon.ico           tab icon for older browsers (16, 32 and 48 px)
//   apple-touch-icon.png  home-screen icon, 180 px, the mark on a full #0b0b0c square (iOS rounds it)
//   icon-192.png, icon-512.png   app icons for the web manifest, full square
// Run it again whenever favicon.svg changes, and add a version to the icon links in index.html
// (favicon.svg?v=2), because browsers keep favicons for a long time.
//   node scripts/make-icons.mjs        (needs Playwright with Chromium)
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const pub = join(dirname(fileURLToPath(import.meta.url)), '../public');
const tile = await readFile(join(pub, 'favicon.svg'), 'utf8');
const TILE = /<rect x="1" y="1" width="62" height="62" rx="14"[^>]*\/>/;
if (!TILE.test(tile)) throw new Error('favicon.svg has no family tile rect (x 1, y 1, 62 wide, rx 14)');
const square = tile.replace(TILE, '<rect width="64" height="64" fill="#0b0b0c"/>');

const browser = await chromium.launch();
async function png(svg, size, clear) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:${clear ? 'transparent' : '#0b0b0c'}}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  const buf = await page.screenshot({ omitBackground: clear });
  await page.close();
  return buf;
}

await writeFile(join(pub, 'favicon-32.png'), await png(tile, 32, true));
await writeFile(join(pub, 'apple-touch-icon.png'), await png(square, 180, false));
await writeFile(join(pub, 'icon-192.png'), await png(square, 192, false));
await writeFile(join(pub, 'icon-512.png'), await png(square, 512, false));

// .ico: a small directory in front of the PNGs themselves
const sizes = [16, 32, 48];
const images = [];
for (const s of sizes) images.push(await png(tile, s, true));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const o = 6 + 16 * i;
  head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
  head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
  head.writeUInt32LE(images[i].length, o + 8); head.writeUInt32LE(offset, o + 12);
  offset += images[i].length;
});
await writeFile(join(pub, 'favicon.ico'), Buffer.concat([head, ...images]));
await browser.close();
console.log('wrote favicon-32.png, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png');
