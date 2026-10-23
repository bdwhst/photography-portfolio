import { tr, ui } from './i18n.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createLightbox({ resolve = (s) => s } = {}) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="lb-stage"></div>
    <span class="counter"></span>
    <button class="lb-btn lb-close" aria-label="关闭"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <button class="lb-btn lb-prev" aria-label="上一张"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5l-7 7 7 7"/></svg></button>
    <button class="lb-btn lb-next" aria-label="下一张"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5l7 7-7 7"/></svg></button>
    <div class="cap"><span class="t"></span><span class="c"></span></div>`;
  document.body.appendChild(el);

  const stage = el.querySelector('.lb-stage');
  const t = el.querySelector('.cap .t');
  const c = el.querySelector('.cap .c');
  const counter = el.querySelector('.counter');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let photos = [], index = 0, isOpen = false;
  let cur = null; // 当前显示的 img

  const preload = (i) => { const p = photos[(i + photos.length) % photos.length]; if (p) new Image().src = resolve(p.src); };
  const setX = (im, x) => im.style.setProperty('--x', x);

  function makeImg(p) {
    const im = document.createElement('img');
    im.alt = tr(p.title); im.draggable = false; im.src = resolve(p.src);
    return im;
  }

  // dir: +1 下一张（新图从右侧滑入），-1 上一张，0 直接切换无动画
  async function show(i, dir = 0) {
    index = (i + photos.length) % photos.length;
    const p = photos[index];
    t.textContent = tr(p.title);
    c.textContent = tr(p.caption);
    counter.textContent = `${index + 1} / ${photos.length}`;
    preload(index + 1); preload(index - 1);

    const old = cur;
    const next = makeImg(p);
    cur = next;
    for (const n of stage.querySelectorAll('img')) if (n !== old) n.remove();

    if (!dir || !old || reduced.matches) { old?.remove(); stage.appendChild(next); return; }

    setX(next, `${dir * 100}vw`);
    stage.appendChild(next);
    await Promise.race([next.decode().catch(() => {}), sleep(250)]);
    if (cur !== next) return; // 期间又翻页了
    next.getBoundingClientRect(); // 让起始位置先生效
    next.classList.add('anim'); old.classList.add('anim');
    setX(next, '0px');
    setX(old, `${-dir * 100}vw`);
    old.addEventListener('transitionend', () => old.remove(), { once: true });
    setTimeout(() => old.remove(), 600);
    setTimeout(() => next.classList.remove('anim'), 500);
  }
  const next = () => show(index + 1, 1);
  const prev = () => show(index - 1, -1);

  function open(list, i = 0) {
    photos = list; if (!photos.length) return;
    isOpen = true; el.classList.add('open'); document.body.style.overflow = 'hidden';
    show(i, 0);
  }
  function close() {
    isOpen = false; el.classList.remove('open'); document.body.style.overflow = '';
    setTimeout(() => { if (!isOpen) { stage.replaceChildren(); cur = null; } }, 300);
  }

  el.querySelector('.lb-close').addEventListener('click', close);
  el.querySelector('.lb-prev').addEventListener('click', prev);
  el.querySelector('.lb-next').addEventListener('click', next);
  el.addEventListener('click', (e) => { if (e.target === el || e.target === stage) close(); });
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
  });

  // 触控：拖动跟手，松手后按方向滑走或弹回
  let x0 = null, t0 = 0, dragging = false;
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; t0 = Date.now(); dragging = false;
    cur?.classList.remove('anim');
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (x0 === null || !cur) return;
    const dx = e.touches[0].clientX - x0;
    if (!dragging && Math.abs(dx) < 8) return;
    dragging = true;
    setX(cur, `${dx}px`);
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dt = Math.max(Date.now() - t0, 1);
    x0 = null;
    if (!dragging) return;
    dragging = false;
    if (Math.abs(dx) > 60 || Math.abs(dx) / dt > 0.5) { dx < 0 ? next() : prev(); return; }
    if (cur) { cur.classList.add('anim'); setX(cur, '0px'); }
  });

  // 触控板横向滑动翻页
  let lastWheel = 0;
  el.addEventListener('wheel', (e) => {
    if (!isOpen || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 20) return;
    const now = Date.now(); if (now - lastWheel < 700) return;
    lastWheel = now; e.deltaX > 0 ? next() : prev();
  }, { passive: true });

  function relabel() {
    el.querySelector('.lb-close').setAttribute('aria-label', ui('close'));
    el.querySelector('.lb-prev').setAttribute('aria-label', ui('prev'));
    el.querySelector('.lb-next').setAttribute('aria-label', ui('next'));
    if (isOpen) show(index, 0);
  }
  relabel();

  return { open, close, relabel, get isOpen() { return isOpen; } };
}
