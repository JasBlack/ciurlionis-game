// Drives the page the way a person would: import a .glb, open a video, fit by points, reset a slider.
// Saves pictures of each step.
//   node tests/ui.mjs <video> <glb> <out folder>
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');

const [video, glb, outDir] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('XNNPACK')) console.log('[error]', m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:5421/?delegate=cpu');
await page.waitForFunction(() => window.__maskLayer, null, { timeout: 120000 });
await page.screenshot({ path: `${outDir}/0-empty.png` });

await page.setInputFiles('#glb-input', glb);
await page.waitForFunction(() => document.querySelectorAll('.tile').length === 4);
console.log('masks:', await page.$$eval('.tile', (els) => els.map((e) => e.innerText.trim())), '|', await page.textContent('#mask-hint'));
console.log('coverage:', await page.textContent('#coverage'));

await page.setInputFiles('#file-input', video);
await page.waitForFunction(() => window.__maskLayer.state.kind === 'file');
await page.waitForTimeout(4000);
await page.click('#landmarks');
await page.waitForTimeout(1500);
await page.locator('#out').screenshot({ path: `${outDir}/1-glb-before-fit.png` });

await page.click('#fit-points');
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/2-calibration.png` });
const anchors = await page.$$eval('.pin', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { key: e.dataset.key, x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
console.log('pins at', JSON.stringify(anchors));
// where the test head's painted eyes and mouth are in this view: project the model's own feature points
const targets = await page.evaluate(() => {
  const { stage } = window.__maskLayer;
  const slot = stage.slots.get('calibration');
  const model = slot.mask.object.children[0];
  slot.root.updateMatrixWorld(true);
  const c = document.getElementById('out');
  const r = c.getBoundingClientRect(), ar = c.width / c.height;
  let w = r.width, h = r.height; if (w / h > ar) w = h * ar; else h = w / ar;
  const left = r.left + (r.width - w) / 2, top = r.top + (r.height - h) / 2;
  const at = (x, y, z) => {
    const v = model.localToWorld(slot.root.position.clone().set(x, y, z)).project(stage.camera);
    return { x: left + ((v.x + 1) / 2) * w, y: top + ((1 - v.y) / 2) * h };
  };
  return { rightEye: at(-0.032, 0.02, 0.091), leftEye: at(0.032, 0.02, 0.091), mouth: at(0, -0.05, 0.09) };
});
console.log('features at', JSON.stringify(targets));
for (const a of anchors) {
  const t = targets[a.key];
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + t.x) / 2, (a.y + t.y) / 2, { steps: 4 });
  await page.mouse.move(t.x, t.y, { steps: 4 });
  await page.mouse.up();
}
await page.screenshot({ path: `${outDir}/3-calibration-dragged.png` });
await page.click('#fit-apply');
console.log('fit after:', await page.evaluate(() => JSON.stringify(window.__maskLayer.stage.fit)));
console.log('coverage:', await page.textContent('#coverage'));
await page.waitForTimeout(4000);
await page.locator('#out').screenshot({ path: `${outDir}/4-glb-after-fit.png` });
// expressions: do the shape keys move?
console.log('morph:', await page.evaluate(() => {
  const out = [];
  window.__maskLayer.stage.scene.traverse((o) => { if (o.isMesh && o.morphTargetInfluences) out.push(o.morphTargetInfluences.map((v) => Number(v.toFixed(3)))); });
  return JSON.stringify(out);
}));
// family rule: right-click any slider puts it back to its default, and no menu opens
const size = page.locator('input[data-fit=scale]');
await size.fill('1.8');
const moved = await page.evaluate(() => window.__maskLayer.stage.fit.scale);
const menu = await page.evaluate(() => { const el = document.querySelector('input[data-fit=scale]'); const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev.defaultPrevented; });
console.log('slider: moved to', moved, '-> right-click ->', await page.evaluate(() => window.__maskLayer.stage.fit.scale), '| menu suppressed:', menu, '| readout:', await page.evaluate(() => document.querySelector('input[data-fit=scale]').closest('.control').querySelector('output').textContent));
await page.setViewportSize({ width: 400, height: 800 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/5-phone.png`, fullPage: true });
await browser.close();
