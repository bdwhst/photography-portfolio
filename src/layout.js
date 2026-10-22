// 布局引擎：根据 layout 配置把照片渲染进容器。支持 masonry / grid / justified / column 四种模式。
import { tr, ui } from './i18n.js';

const SPANS = [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 2, row: 2 }, { col: 1, row: 2 }];

export function nextSpan(span) {
  const i = SPANS.findIndex((s) => s.col === (span?.col ?? 1) && s.row === (span?.row ?? 1));
  return SPANS[(i + 1) % SPANS.length];
}

export function effectiveColumns(cols, width) {
  cols = Math.max(1, Math.min(6, cols | 0 || 3));
  if (width < 520) return 1;
  if (width < 900) return Math.min(cols, 2);
  if (width < 1200) return Math.max(1, cols - 1);
  return cols;
}

const ratio = (p) => (p.w && p.h ? p.w / p.h : 1.5);

export class Gallery {
  constructor(el, { onItemClick, resolve = (s) => s } = {}) {
    this.el = el;
    this.onItemClick = onItemClick;
    this.resolve = resolve;
    this.photos = [];
    this.layout = {};
    this.editable = false;
    this.selectedId = null;
    this.lastWidth = el.clientWidth;

    this.ro = new ResizeObserver(() => {
      const w = this.el.clientWidth;
      if (w && w !== this.lastWidth) { this.lastWidth = w; this.render(); }
    });
    this.ro.observe(el);

    el.addEventListener('click', (e) => {
      const item = e.target.closest('.item');
      if (!item) return;
      this.onItemClick?.(Number(item.dataset.index), item, e);
    });
  }

  set({ photos, layout, editable, selectedId }) {
    if (photos) this.photos = photos;
    if (layout) this.layout = layout;
    if (editable !== undefined) this.editable = editable;
    if (selectedId !== undefined) this.selectedId = selectedId;
    this.render();
  }

  select(id) {
    this.selectedId = id;
    this.el.querySelectorAll('.item.selected').forEach((n) => n.classList.remove('selected'));
    if (id != null) this.el.querySelector(`.item[data-id="${CSS.escape(String(id))}"]`)?.classList.add('selected');
  }

  render() {
    const { el, photos } = this;
    const L = { mode: 'masonry', columns: 3, gap: 16, rowHeight: 320, radius: 0, maxWidth: 1400, ...this.layout };
    const width = el.clientWidth || 1200;
    let mode = ['masonry', 'grid', 'justified', 'column'].includes(L.mode) ? L.mode : 'masonry';
    if (mode === 'justified' && width < 520) mode = 'column';

    el.style.setProperty('--gap', `${L.gap}px`);
    el.style.setProperty('--radius', `${L.radius}px`);
    el.parentElement?.style.setProperty('--max-width', `${L.maxWidth}px`);
    el.className = `gallery mode-${mode}`;
    el.style.gridTemplateColumns = '';
    el.style.gridAutoRows = '';
    el.replaceChildren();

    if (!photos.length) {
      const p = document.createElement('p');
      p.className = 'empty'; p.textContent = ui('empty');
      el.appendChild(p);
      return;
    }

    const cols = effectiveColumns(L.columns, width);
    this[`render_${mode}`](photos, L, width, cols);
    this.observeImages();
  }

  item(p, i, { full = false, span = null } = {}) {
    const fig = document.createElement('figure');
    fig.className = 'item';
    fig.dataset.index = i;
    fig.dataset.id = p.id;
    fig.style.setProperty('--ar', `${p.w || 3} / ${p.h || 2}`);
    if (span) { fig.style.gridColumn = `span ${span.col}`; fig.style.gridRow = `span ${span.row}`; }
    if (this.editable) fig.draggable = true;
    if (this.editable && this.selectedId === p.id) fig.classList.add('selected');

    const img = document.createElement('img');
    img.src = this.resolve(full ? p.src : (p.thumb || p.src));
    const title = tr(p.title), caption = tr(p.caption);
    img.alt = title;
    img.loading = 'lazy';
    img.decoding = 'async';
    if (p.w && p.h) { img.width = p.w; img.height = p.h; }
    fig.appendChild(img);

    if (title || caption) {
      const cap = document.createElement('figcaption');
      if (title) { const t = document.createElement('span'); t.className = 't'; t.textContent = title; cap.appendChild(t); }
      if (caption) { const c = document.createElement('span'); c.className = 'c'; c.textContent = caption; cap.appendChild(c); }
      fig.appendChild(cap);
    }
    if (this.editable && span) {
      const b = document.createElement('span');
      b.className = 'span-badge'; b.textContent = `${span.col}×${span.row}`;
      fig.appendChild(b);
    }
    return fig;
  }

  render_masonry(photos, L, width, cols) {
    const colEls = Array.from({ length: cols }, () => {
      const d = document.createElement('div'); d.className = 'col'; return d;
    });
    const heights = new Array(cols).fill(0);
    photos.forEach((p, i) => {
      let k = 0;
      for (let c = 1; c < cols; c++) if (heights[c] < heights[k] - 0.001) k = c;
      colEls[k].appendChild(this.item(p, i, { full: cols === 1 }));
      heights[k] += 1 / ratio(p);
    });
    this.el.append(...colEls);
  }

  render_grid(photos, L, width, cols) {
    const cell = (width - L.gap * (cols - 1)) / cols;
    this.el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.el.style.gridAutoRows = `${cell}px`;
    photos.forEach((p, i) => {
      const s = p.span || { col: 1, row: 1 };
      const span = { col: Math.min(Math.max(1, s.col | 0 || 1), cols), row: Math.max(1, s.row | 0 || 1) };
      this.el.appendChild(this.item(p, i, { span, full: span.col * cell > 900 }));
    });
  }

  render_justified(photos, L, width) {
    const target = L.rowHeight || 320;
    const rows = [];
    let row = [], sum = 0;
    photos.forEach((p, i) => {
      row.push({ p, i, r: ratio(p) });
      sum += ratio(p);
      const avail = width - L.gap * (row.length - 1);
      if (avail / sum <= target) { rows.push({ items: row, h: avail / sum }); row = []; sum = 0; }
    });
    if (row.length) {
      const avail = width - L.gap * (row.length - 1);
      rows.push({ items: row, h: Math.min(avail / sum, target * 1.15), last: true });
    }
    rows.forEach(({ items, h }) => {
      const r = document.createElement('div'); r.className = 'row';
      items.forEach(({ p, i, r: ar }) => {
        const fig = this.item(p, i, { full: h > 700 });
        fig.style.width = `${Math.floor(ar * h)}px`;
        fig.style.height = `${Math.floor(h)}px`;
        r.appendChild(fig);
      });
      this.el.appendChild(r);
    });
  }

  render_column(photos) {
    photos.forEach((p, i) => this.el.appendChild(this.item(p, i, { full: true })));
  }

  observeImages() {
    this.el.querySelectorAll('img').forEach((img) => {
      if (img.complete && img.naturalWidth) img.classList.add('loaded');
      else img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    });
  }
}
