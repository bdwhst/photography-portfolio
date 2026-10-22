import { tr, ui } from './i18n.js';

export function createLightbox({ resolve = (s) => s } = {}) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <span class="counter"></span>
    <button class="lb-btn lb-close" aria-label="关闭"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <button class="lb-btn lb-prev" aria-label="上一张"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5l-7 7 7 7"/></svg></button>
    <img alt="" />
    <button class="lb-btn lb-next" aria-label="下一张"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5l7 7-7 7"/></svg></button>
    <div class="cap"><span class="t"></span><span class="c"></span></div>`;
  document.body.appendChild(el);

  const img = el.querySelector('img');
  const t = el.querySelector('.cap .t');
  const c = el.querySelector('.cap .c');
  const counter = el.querySelector('.counter');
  let photos = [], index = 0, isOpen = false;

  const preload = (i) => { const p = photos[i]; if (p) new Image().src = resolve(p.src); };

  function show(i) {
    index = (i + photos.length) % photos.length;
    const p = photos[index];
    img.src = resolve(p.src);
    img.alt = tr(p.title);
    t.textContent = tr(p.title);
    c.textContent = tr(p.caption);
    counter.textContent = `${index + 1} / ${photos.length}`;
    preload(index + 1); preload(index - 1);
  }
  function open(list, i = 0) {
    photos = list; if (!photos.length) return;
    isOpen = true; el.classList.add('open'); document.body.style.overflow = 'hidden';
    show(i);
  }
  function close() {
    isOpen = false; el.classList.remove('open'); document.body.style.overflow = '';
    setTimeout(() => { if (!isOpen) img.removeAttribute('src'); }, 300);
  }

  el.querySelector('.lb-close').addEventListener('click', close);
  el.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
  el.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });
  let x0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(dx < 0 ? index + 1 : index - 1);
  });

  function relabel() {
    el.querySelector('.lb-close').setAttribute('aria-label', ui('close'));
    el.querySelector('.lb-prev').setAttribute('aria-label', ui('prev'));
    el.querySelector('.lb-next').setAttribute('aria-label', ui('next'));
    if (isOpen) show(index);
  }
  relabel();

  return { open, close, relabel, get isOpen() { return isOpen; } };
}
