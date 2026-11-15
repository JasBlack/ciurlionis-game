// JAS.BLACK tool family: shared behaviour. This is kit/family.js from the family blueprint, as a module so the
// build can bundle it. It does what the kit does, with one difference, marked below.
// The version is set once on <body data-version="x.y.z">. The tool's own code can call toast('saved') and
// paintRange(input) after it sets a slider from code.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

// version: shown only while the title is hovered (.brand-ver right after .brand)
const ver = document.body.dataset.version;
for (const el of $$('.brand-ver')) if (ver && !el.textContent) el.textContent = `v${ver}`;

// light / dark, remembered per tool (key: <tool>-ui). The stage stays dark either way.
const tool = (document.body.dataset.tool || location.hostname.split('.')[0] || 'tool').toLowerCase();
export const setUI = (t) => { document.body.dataset.ui = t; store.set(`${tool}-ui`, t); };
setUI(store.get(`${tool}-ui`) === 'light' ? 'light' : (document.body.dataset.ui || 'dark'));
for (const b of $$('[data-action=theme]')) b.addEventListener('click', () => setUI(document.body.dataset.ui === 'dark' ? 'light' : 'dark'));

// sliders: green fill up to the value
export const paintRange = (el) => el.style.setProperty('--pct', `${((el.value - el.min) / ((el.max - el.min) || 1)) * 100}%`);
document.addEventListener('input', (e) => { if (e.target.type === 'range') paintRange(e.target); });

// right-click any slider: back to its default. Family rule: every tool does this.
// The one difference from the kit: the default is the slider's value="" in the markup where it has one, and only
// otherwise its value when first seen. This tool puts saved settings back into its sliders as it loads, and a
// right-click should return a slider to the tool's default, not to whatever was saved last time.
const defs = new WeakMap();
const remember = () => {
  for (const el of $$('input[type=range]')) {
    if (!defs.has(el)) defs.set(el, el.getAttribute('value') ?? el.value);
    paintRange(el);
  }
};
remember();
addEventListener('load', remember);
new MutationObserver(remember).observe(document.body, { childList: true, subtree: true }); // sliders built later
document.addEventListener('contextmenu', (e) => {
  const el = e.target;
  if (e.defaultPrevented || !(el instanceof HTMLInputElement) || el.type !== 'range' || el.disabled) return;
  e.preventDefault();
  const d = defs.get(el) ?? el.defaultValue;
  if (el.value === d) return;
  el.value = d;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});

// segmented switches: one pressed at a time
for (const seg of $$('.seg')) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const o of $$('button', seg)) o.setAttribute('aria-pressed', String(o === b));
  });
}

// full screen key
for (const b of $$('[data-action=fullscreen]')) {
  b.addEventListener('click', () => {
    const t = $(b.dataset.target || '.monitor') || document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.(); else t.requestFullscreen?.();
  });
}

// toast, bottom right
let toastTimer = 0;
export const toast = (msg) => {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 2600);
};

window.JB = { toast, paintRange, setUI };
