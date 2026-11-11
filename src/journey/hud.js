// What is written over the picture: the title with its loading bar (it is the first thing seen, before anything is
// painted), the name of each painting as he comes into it, and the pearls he has found there.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const cap = $('caption'), pearls = $('pearls'), title = $('title'), bar = $('bar'), begin = $('begin'), backdrop = $('backdrop'), hint = $('hint');
  let timer = 0;
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
      setTimeout(() => backdrop?.remove(), 2400);
      bar?.classList.add('done');
      if (withTitle) { if (begin) { begin.textContent = 'Click to begin'; begin.classList.add('ready'); } } else title?.classList.add('off');
      hint?.classList.add('on');
      setTimeout(() => hint?.classList.remove('on'), 16000);
    },
    /** The title leaves. */
    begin() {
      title?.classList.add('gone');
      setTimeout(() => title?.classList.add('off'), 2600);
    },
    caption(main, sub = '', hold = 7) {
      if (!cap) return;
      cap.querySelector('b').textContent = main;
      cap.querySelector('i').textContent = sub;
      cap.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => cap.classList.remove('on'), hold * 1000);
    },
    pearls(got, total = 3) {
      if (!pearls) return;
      if (pearls.children.length !== total) pearls.innerHTML = '<span></span>'.repeat(total);
      [...pearls.children].forEach((s, i) => s.classList.toggle('got', i < got));
      pearls.classList.add('on');
    },
  };
}
