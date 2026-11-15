// The live path: a (fake) camera, the mirror, and Record. Chromium plays a .y4m file as its camera.
//   node tests/camera.mjs <camera.y4m> <out folder>
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');

const [y4m, outDir] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('XNNPACK')) console.log('[error]', m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:5421/?delegate=cpu');
await page.waitForFunction(() => window.__maskLayer, null, { timeout: 120000 });
await page.click('#empty-camera');
await page.waitForFunction(() => window.__maskLayer.state.kind === 'camera' && window.__maskLayer.state.tracks.length > 0, null, { timeout: 60000 });
console.log('camera running; mirror:', await page.isChecked('#mirror'), '| chip:', await page.textContent('#chip-state'), '|', await page.textContent('#chip-perf'));
await page.screenshot({ path: `${outDir}/camera.png` });
await page.click('#record');
await page.waitForFunction(() => document.getElementById('record').textContent === 'Stop recording');
await page.waitForTimeout(6000);
const download = page.waitForEvent('download', { timeout: 60000 });
await page.click('#record');
const d = await download;
await d.saveAs(`${outDir}/${d.suggestedFilename()}`);
console.log('recorded:', d.suggestedFilename(), '|', await page.textContent('#save-note'));
await page.click('#camera');
console.log('after stop: kind =', await page.evaluate(() => window.__maskLayer.state.kind), '| empty state shown:', await page.isVisible('#empty'));
await browser.close();
