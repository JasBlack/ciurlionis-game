// Exports a video through the app and saves the result, to check that every source frame comes out the other end.
//   node tests/export.mjs <video> <output file> [mask id]
// Needs "npm run build" and "npm run preview" (port 5421).
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');

const [video, outFile, mask = 'satyr'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('XNNPACK')) console.log('[error]', m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:5421/?delegate=cpu');
await page.waitForFunction(() => window.__maskLayer, null, { timeout: 120000 });
await page.evaluate((id) => window.__maskLayer.selectMask(id), mask);
await page.setInputFiles('#file-input', video);
await page.waitForFunction(() => window.__maskLayer.state.kind === 'file', null, { timeout: 30000 });
const download = page.waitForEvent('download', { timeout: 1500000 });
await page.click('.transport [data-do=export]');
await page.waitForFunction(() => window.__lastExport || /failed|cancelled/i.test(document.getElementById('save-note').textContent), null, { timeout: 1500000, polling: 1000 });
console.log('note:', await page.textContent('#save-note'));
const info = await page.evaluate(() => {
  const r = window.__lastExport;
  if (!r) return null;
  const tally = {};
  for (const f of r.log) { const k = f.hidden ? 'hidden' : (f.states.join('+') || 'none'); tally[k] = (tally[k] || 0) + 1; }
  return { filename: r.filename, frames: r.frames, frameRate: r.frameRate, codec: r.codec, audioKept: r.audioKept, bytes: r.blob.size, tally };
});
console.log(JSON.stringify(info));
const d = await download;
await d.saveAs(outFile);
console.log('saved', outFile, 'suggested name:', d.suggestedFilename());
await browser.close();
