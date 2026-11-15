// Opens the built app in headless Chromium, plays a video through it and saves pictures of what it shows.
//   node tests/smoke.mjs <video file> <output folder> [seconds] [mask id]
// Needs "npm run build" and "npm run preview" running (port 5421).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdir } from 'node:fs/promises';

const [video, outDir, seconds = '12', mask = 'satyr'] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5421/?delegate=cpu');
await page.waitForFunction(() => window.__maskLayer, null, { timeout: 120000 });
console.log('engine:', await page.textContent('#engine'));
await page.evaluate((id) => window.__maskLayer.selectMask(id), mask);
await page.setInputFiles('#file-input', video);
await page.waitForFunction(() => window.__maskLayer.state.kind === 'file', null, { timeout: 30000 });
const n = Number(seconds);
for (let i = 0; i < n; i++) {
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    const { state, tracker } = window.__maskLayer;
    return { t: document.getElementById('video').currentTime.toFixed(2), chip: document.getElementById('chip-state').textContent, perf: document.getElementById('chip-perf').textContent, states: state.tracks.map((t) => t.state), stats: tracker.stats };
  });
  console.log(JSON.stringify(info));
  await page.locator('#out').screenshot({ path: `${outDir}/frame-${String(i).padStart(2, '0')}.png` });
}
await page.screenshot({ path: `${outDir}/page.png` });
await browser.close();
