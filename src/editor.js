// 可视化编辑器（仅开发模式加载）：布局参数、拖拽排序、点选标签，改动自动写回 public/gallery.json
import { ui, tr } from './i18n.js';

const MODES = ['masonry', 'grid', 'justified', 'column'];
const FIELDS = [
  ['columns', 1, 6, 1, ['masonry', 'grid']],
  ['gap', 0, 48, 2, ['masonry', 'grid', 'justified', 'column']],
  ['rowHeight', 160, 600, 10, ['justified']],
  ['radius', 0, 24, 1, ['masonry', 'grid', 'justified', 'column']],
  ['maxWidth', 800, 2400, 50, ['masonry', 'grid', 'justified', 'column']],
];
const SPANS = [[1, 1], [2, 1], [2, 2], [1, 2]];

export function createEditor({ getLayout, onLayoutChange, onReset, onCleanTags, onToggle }) {
  const el = document.createElement('aside');
  el.className = 'editor';
  el.innerHTML = `
    <h3><span data-i18n="editTitle"></span> <button class="close" data-i18n-label="close">✕</button></h3>
    <div class="modes">${MODES.map((k) => `<button data-mode="${k}" data-i18n="${k}"></button>`).join('')}</div>
    ${FIELDS.map(([k, min, max, step]) => `
      <label class="field" data-field="${k}"><span data-i18n="${k}"></span>
        <input type="range" name="${k}" min="${min}" max="${max}" step="${step}" /><output></output></label>`).join('')}
    <p class="hint" data-i18n="hint"></p>
    <div class="actions"><button class="reset" data-i18n="reset"></button><button class="clean" data-i18n="cleanTags"></button></div>
    <div class="status"></div>`;
  document.body.appendChild(el);
  const status = el.querySelector('.status');

  function relabel() {
    el.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = ui(n.dataset.i18n); });
    el.querySelectorAll('[data-i18n-label]').forEach((n) => n.setAttribute('aria-label', ui(n.dataset.i18nLabel)));
  }
  relabel();

  function sync() {
    const L = getLayout();
    el.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === L.mode));
    FIELDS.forEach(([k, , , , modes]) => {
      const f = el.querySelector(`[data-field="${k}"]`);
      f.querySelector('input').value = L[k];
      f.querySelector('output').textContent = L[k];
      f.classList.toggle('disabled', !modes.includes(L.mode));
    });
  }

  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { onLayoutChange({ mode: b.dataset.mode }); sync(); }));
  el.querySelectorAll('input[type="range"]').forEach((inp) => inp.addEventListener('input', () => {
    onLayoutChange({ [inp.name]: Number(inp.value) });
    inp.nextElementSibling.textContent = inp.value;
  }));
  el.querySelector('.close').addEventListener('click', () => toggle(false));
  el.querySelector('.reset').addEventListener('click', async () => { await onReset(); sync(); status.textContent = ui('resetDone'); });
  el.querySelector('.clean').addEventListener('click', () => onCleanTags());

  let open = false;
  function toggle(force) {
    open = force ?? !open;
    el.classList.toggle('open', open);
    document.body.classList.toggle('editing', open);
    if (open) sync();
    onToggle?.(open);
  }
  const setStatus = (t) => { status.textContent = t; };

  return { toggle, sync, relabel, setStatus, get isOpen() { return open; } };
}

// 标签编辑框：点一张照片后出现，点选标签 / 新建标签 / 网格占位
export function createTagBox({ getCategories, onToggleTag, onAddTag, onSpan, resolve, onClose }) {
  const el = document.createElement('aside');
  el.className = 'tagbox';
  el.innerHTML = `
    <div class="head"><img alt="" /><div class="name"><span class="t"></span><small class="f"></small></div><button class="close">✕</button></div>
    <div class="label" data-i18n="tags"></div>
    <div class="chips"></div>
    <div class="label" data-i18n="addTag"></div>
    <div class="addrow">
      <input class="zh" data-i18n-ph="zhName" /><input class="en" data-i18n-ph="enName" /><button class="add" data-i18n="add"></button>
    </div>
    <div class="spanwrap"><div class="label" data-i18n="span"></div>
      <div class="spanrow">${SPANS.map(([c, r]) => `<button data-span="${c},${r}">${c}×${r}</button>`).join('')}</div>
    </div>`;
  document.body.appendChild(el);

  let photo = null;
  const chips = el.querySelector('.chips');

  function relabel() {
    el.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = ui(n.dataset.i18n); });
    el.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = ui(n.dataset.i18nPh); });
    if (photo) render();
  }

  function render() {
    if (!photo) return;
    el.querySelector('.head img').src = resolve(photo.thumb || photo.src);
    el.querySelector('.head .t').textContent = tr(photo.title) || photo.id;
    el.querySelector('.head .f').textContent = (photo.sources || []).join(', ');
    chips.replaceChildren();
    const cats = getCategories();
    const keys = Object.keys(cats);
    if (!keys.length) { const p = document.createElement('span'); p.className = 'empty-hint'; p.textContent = '—'; chips.appendChild(p); }
    keys.forEach((k) => {
      const b = document.createElement('button');
      b.textContent = tr(cats[k]) || k;
      b.classList.toggle('active', (photo.tags || []).includes(k));
      b.addEventListener('click', () => { onToggleTag(photo, k); render(); });
      chips.appendChild(b);
    });
    const s = photo.span || { col: 1, row: 1 };
    el.querySelectorAll('[data-span]').forEach((b) => b.classList.toggle('active', b.dataset.span === `${s.col},${s.row}`));
  }

  el.querySelector('.close').addEventListener('click', () => { hide(); onClose?.(); });
  el.querySelector('.add').addEventListener('click', add);
  el.querySelectorAll('.addrow input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); }));
  el.querySelectorAll('[data-span]').forEach((b) => b.addEventListener('click', () => {
    const [col, row] = b.dataset.span.split(',').map(Number);
    onSpan(photo, { col, row }); render();
  }));

  function add() {
    const zh = el.querySelector('.zh').value.trim(), en = el.querySelector('.en').value.trim();
    if (!zh && !en) return;
    const key = onAddTag({ zh: zh || en, en: en || zh });
    if (key && photo) onToggleTag(photo, key, true);
    el.querySelector('.zh').value = ''; el.querySelector('.en').value = '';
    render();
  }
  function show(p, { gridMode }) {
    photo = p;
    el.querySelector('.spanwrap').style.display = gridMode ? '' : 'none';
    el.classList.add('open');
    render();
  }
  function hide() { photo = null; el.classList.remove('open'); }

  relabel();
  return { show, hide, render, relabel, get photo() { return photo; } };
}

// 在画廊容器上启用 HTML5 拖拽排序；onMove(fromId, toId) 把 fromId 移到 toId 的位置
export function enableDragSort(container, { onMove, enabled }) {
  let dragId = null;
  container.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.item');
    if (!item || !enabled()) return;
    dragId = item.dataset.id;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  container.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const item = e.target.closest('.item');
    if (!item) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.querySelectorAll('.drag-over').forEach((n) => n !== item && n.classList.remove('drag-over'));
    if (item.dataset.id !== dragId) item.classList.add('drag-over');
  });
  container.addEventListener('dragleave', (e) => {
    const item = e.target.closest('.item');
    if (item && !item.contains(e.relatedTarget)) item.classList.remove('drag-over');
  });
  container.addEventListener('drop', (e) => {
    const item = e.target.closest('.item');
    if (!dragId || !item) return;
    e.preventDefault();
    const toId = item.dataset.id;
    if (toId !== dragId) onMove(dragId, toId);
    dragId = null;
  });
  container.addEventListener('dragend', () => {
    dragId = null;
    container.querySelectorAll('.dragging, .drag-over').forEach((n) => n.classList.remove('dragging', 'drag-over'));
  });
}
