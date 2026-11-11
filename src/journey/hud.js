// What is written over the picture: the name of each painting as he comes into it, what E would do, and the
// pearls he has been given.
export function createHud() {
  const cap = document.getElementById('caption'), prompt = document.getElementById('prompt'), pearls = document.getElementById('pearls'), title = document.getElementById('title');
  let timer = 0, shownPrompt = null;
  return {
    wash: 0, // how far the card has come back through the paint (read by the frame)
    caption(main, sub = '', hold = 7) {
      if (!cap) return;
      cap.querySelector('b').textContent = main;
      cap.querySelector('i').textContent = sub;
      cap.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => cap.classList.remove('on'), hold * 1000);
    },
    prompt(text) {
      if (!prompt || text === shownPrompt) return;
      shownPrompt = text;
      if (text) prompt.innerHTML = `<kbd>E</kbd>${text}`;
      prompt.classList.toggle('on', !!text);
    },
    pearls(got, total = 7) {
      if (!pearls) return;
      if (pearls.children.length !== total) pearls.innerHTML = '<span></span>'.repeat(total);
      [...pearls.children].forEach((s, i) => s.classList.toggle('got', i < got));
      pearls.classList.toggle('on', got > 0);
    },
    title(on) {
      if (!title) return;
      if (on) title.classList.add('on');
      else { title.classList.add('gone'); setTimeout(() => title.classList.remove('on'), 2600); }
    },
  };
}
