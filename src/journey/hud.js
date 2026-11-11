// What is written over the picture: the title with its loading bar (it is the first thing seen, before anything is
// painted), the name of each painting as he comes into it, and the pearls he has found there.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const cap = $('caption'), pearls = $('pearls'), title = $('title'), bar = $('bar'), begin = $('begin'), backdrop = $('backdrop'), hint = $('hint');
  let timer = 0, lastGot = 0;
  return {
    wash: 0, // how far the card has come back through the paint (read by the frame)
    /** Loading: how far along (0..1) and what is being done. */
    progress(value, label) {
      if (bar) bar.firstElementChild.style.width = `${Math.round(Math.max(0.03, Math.min(1, value)) * 100)}%`;
      if (begin && label) begin.textContent = label;
    },
    /** The picture is ready: the flat backdrop gives way to it. withTitle: the title stays, and asks for a click. */
    ready(withTitle) {
      backdrop?.classList.add('gone');
      setTimeout(() => backdrop?.remove(), 2600);
      bar?.classList.add('done');
      if (withTitle) {
        title?.classList.add('ready');
        if (begin) { begin.textContent = 'Click to begin'; begin.classList.add('ready'); }
      } else { title?.classList.add('off'); this.hint(); }
    },
    /** The title leaves. */
    begin() {
      title?.classList.add('gone');
      setTimeout(() => title?.classList.add('off'), 2600);
      setTimeout(() => this.hint(), 1800);
    },
    /** The keys, in the corner for a while. */
    hint() {
      hint?.classList.add('on');
      setTimeout(() => hint?.classList.remove('on'), 16000);
    },
    caption(main, sub = '', hold = 7) {
      if (!cap) return;
      cap.querySelector('b').textContent = main;
      cap.querySelector('i').textContent = sub;
      cap.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => cap.classList.remove('on'), hold * 1000);
    },
    /** The pearls he has found here: a little constellation, its stars lit as he finds them. */
    pearls(got, total = 3) {
      if (!pearls) return;
      const step = total > 6 ? 20 : 28, r = total > 6 ? 6.2 : 8, w = total * step, fresh = got > lastGot && pearls.dataset.total === String(total);
      const pts = Array.from({ length: total }, (_, k) => [step / 2 + k * step, 14 + 7 * Math.sin(k * 1.9)]);
      const star = (x, y) => `M${x},${y - r}L${x + r * 0.28},${y - r * 0.28}L${x + r},${y}L${x + r * 0.28},${y + r * 0.28}L${x},${y + r}L${x - r * 0.28},${y + r * 0.28}L${x - r},${y}L${x - r * 0.28},${y - r * 0.28}Z`;
      pearls.innerHTML = `<svg width="${w}" height="30" viewBox="0 -1 ${w} 30" aria-hidden="true"><polyline points="${pts.map((q) => q.join(',')).join(' ')}" fill="none" stroke-width="1.1"/>`
        + pts.map(([x, y], k) => `<path class="${k < got ? 'got' : ''}${fresh && k === got - 1 ? ' new' : ''}" d="${star(x, y)}"/>`).join('') + '</svg>';
      pearls.dataset.total = String(total);
      pearls.setAttribute('aria-label', `${got} of ${total} pearls found`);
      lastGot = got;
      pearls.classList.add('on');
    },
  };
}
