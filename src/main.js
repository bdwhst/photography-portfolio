import './style.css';
import { Gallery } from './layout.js';
import { createLightbox } from './lightbox.js';
import { detectLang, getLang, setLang, ui, tr } from './i18n.js';

const BASE = import.meta.env.BASE_URL;
const resolve = (s) => (/^(https?:)?\/\//.test(s) ? s : BASE + s.replace(/^\//, ''));
const $ = (id) => document.getElementById(id);

const state = { site: {}, layout: {}, categories: {}, photos: [], tag: 'all', editing: false, protect: true };
let original = null;
let editor = null, tagBox = null; // 仅开发模式存在

async function loadData() {
  const res = await fetch(`${BASE}gallery.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`gallery.json ${res.status}`);
  return res.json();
}

/* ---------- 语言 ---------- */
const urlLang = new URLSearchParams(location.search).get('lang');
setLang(urlLang || detectLang());

function applyUiStrings() {
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = ui(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach((n) => n.setAttribute('aria-label', ui(n.dataset.i18nLabel)));
  document.querySelectorAll('[data-i18n-title]').forEach((n) => n.setAttribute('title', ui(n.dataset.i18nTitle)));
}
$('lang-toggle').addEventListener('click', () => {
  setLang(getLang() === 'zh' ? 'en' : 'zh');
  renderAll();
});

/* ---------- 主题 ---------- */
const root = document.documentElement;
try { const t = localStorage.getItem('theme'); if (t) root.dataset.theme = t; } catch {}
$('theme-toggle').addEventListener('click', () => {
  const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch {}
});
addEventListener('scroll', () => document.querySelector('.nav').classList.toggle('scrolled', scrollY > 10), { passive: true });

/* ---------- 站点信息 ---------- */
function renderSite() {
  const s = state.site;
  const title = tr(s.title) || ui('portfolio');
  document.title = [title, tr(s.subtitle)].filter(Boolean).join(' · ');
  $('brand').textContent = title;
  $('site-title').textContent = title;
  $('site-subtitle').textContent = tr(s.subtitle);
  $('site-about').textContent = tr(s.about);
  $('site-copyright').textContent = tr(s.copyright);
  const contact = $('site-contact');
  contact.replaceChildren();
  const links = [...(s.email ? [{ label: s.email, url: `mailto:${s.email}` }] : []), ...(s.links || [])];
  links.forEach((l) => {
    const a = document.createElement('a');
    a.href = l.url; a.textContent = tr(l.label);
    if (!l.url.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
    contact.appendChild(a);
  });
}

/* ---------- 筛选 ---------- */
function visiblePhotos() {
  return state.tag === 'all' ? state.photos : state.photos.filter((p) => p.tags?.includes(state.tag));
}
function renderFilters() {
  const used = new Set(state.photos.flatMap((p) => p.tags || []));
  // 先按 categories 的顺序，再补上照片里出现但未登记的标签
  const keys = [...Object.keys(state.categories).filter((k) => used.has(k)), ...[...used].filter((k) => !(k in state.categories))];
  const wrap = $('filters');
  wrap.replaceChildren();
  if (!keys.length) return;
  if (state.tag !== 'all' && !keys.includes(state.tag)) state.tag = 'all';
  [['all', ui('all')], ...keys.map((k) => [k, tr(state.categories[k]) || k])].forEach(([key, label]) => {
    const b = document.createElement('button');
    b.className = 'chip' + (state.tag === key ? ' active' : '');
    b.textContent = label; b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { state.tag = key; renderFilters(); renderGallery(); });
    wrap.appendChild(b);
  });
}

/* ---------- 画廊 / 灯箱 ---------- */
const lightbox = createLightbox({ resolve });
const gallery = new Gallery($('gallery'), {
  resolve,
  onItemClick(i) {
    const list = visiblePhotos();
    if (!state.editing) return lightbox.open(list, i);
    const p = list[i];
    gallery.select(p.id);
    tagBox?.show(p, { gridMode: state.layout.mode === 'grid' });
  },
});
function renderGallery() {
  gallery.set({ photos: visiblePhotos(), layout: state.layout, editable: state.editing });
}
function renderAll() {
  applyUiStrings(); renderSite(); renderFilters(); renderGallery();
  lightbox.relabel(); editor?.relabel(); editor?.sync(); tagBox?.relabel();
}

/* ---------- 版权保护：禁用图片右键与拖拽保存（只能挡住普通访客） ---------- */
document.addEventListener('contextmenu', (e) => {
  if (state.protect && e.target.closest('img, .item, .lightbox')) e.preventDefault();
});
document.addEventListener('dragstart', (e) => {
  if (state.protect && e.target.tagName === 'IMG') e.preventDefault();
});

/* ---------- 启动 ---------- */
function applyData(data) {
  state.site = data.site || {};
  state.categories = data.categories || {};
  state.protect = data.protect !== false;
  document.body.classList.toggle('protected', state.protect);
  state.layout = { mode: 'masonry', columns: 3, gap: 16, rowHeight: 320, radius: 0, maxWidth: 1400, ...(data.layout || {}) };
  state.photos = (data.photos || []).map((p, i) => ({ id: p.id || `p${i}`, ...p }));
  // 临时预览某种布局：?mode=grid（不会写回文件）
  const m = new URLSearchParams(location.search).get('mode');
  if (['masonry', 'grid', 'justified', 'column'].includes(m)) state.layout.mode = m;
  renderAll();
}

applyUiStrings();
$('gallery').classList.add('loading');
loadData()
  .then((data) => {
    original = structuredClone(data);
    applyData(data);
    if (import.meta.env.DEV) setupEditor();
  })
  .catch((err) => {
    $('gallery').innerHTML = `<p class="empty">${ui('loadFail')}<br><small>${err.message}</small></p>`;
  })
  .finally(() => $('gallery').classList.remove('loading'));

/* ---------- 编辑器：只在 npm run dev 时加载，打包产物里不含这段代码与保存接口 ---------- */
if (!import.meta.env.DEV) $('edit-toggle').remove();

async function setupEditor() {
  const { createEditor, createTagBox, enableDragSort } = await import('./editor.js');

  // 自动保存：改动后 600ms 写回 public/gallery.json
  let saveTimer;
  const serialize = () => {
    const photos = state.photos.map((p) => {
      const { span, ...rest } = p;
      return span && (span.col > 1 || span.row > 1) ? { ...rest, span } : rest;
    });
    return { site: state.site, layout: state.layout, output: original?.output, protect: state.protect,
             categories: state.categories, photos };
  };
  function scheduleSave() {
    clearTimeout(saveTimer);
    editor.setStatus(ui('saving'));
    saveTimer = setTimeout(save, 600);
  }
  async function save() {
    const data = serialize();
    try {
      const res = await fetch('/__gallery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(res.statusText);
      original = structuredClone(data);
      editor.setStatus(`${ui('saved')} ${new Date().toLocaleTimeString()}`);
    } catch { editor.setStatus(ui('saveFail')); }
  }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '') || 'tag';

  editor = createEditor({
    getLayout: () => state.layout,
    onLayoutChange(patch) { Object.assign(state.layout, patch); renderGallery(); scheduleSave(); },
    async onReset() { applyData(await loadData()); tagBox.hide(); gallery.select(null); },
    onCleanTags() {
      const used = new Set(state.photos.flatMap((p) => p.tags || []));
      for (const k of Object.keys(state.categories)) if (!used.has(k)) delete state.categories[k];
      renderFilters(); tagBox.render(); scheduleSave();
    },
    onToggle(open) {
      state.editing = open;
      const url = new URL(location);
      open ? url.searchParams.set('edit', '') : url.searchParams.delete('edit');
      history.replaceState(null, '', url);
      if (!open) { tagBox.hide(); gallery.select(null); }
      renderGallery();
    },
  });

  tagBox = createTagBox({
    resolve,
    getCategories: () => state.categories,
    onToggleTag(photo, key, force) {
      const has = (photo.tags || []).includes(key);
      if (force === true && has) return;
      photo.tags = has ? photo.tags.filter((t) => t !== key) : [...(photo.tags || []), key];
      renderFilters(); renderGallery(); scheduleSave();
    },
    onAddTag({ zh, en }) {
      let key = slug(en || zh);
      if (state.categories[key]) return key;
      state.categories[key] = { zh, en };
      scheduleSave();
      return key;
    },
    onSpan(photo, span) { photo.span = span; renderGallery(); scheduleSave(); },
    onClose() { gallery.select(null); },
  });

  enableDragSort($('gallery'), {
    enabled: () => state.editing,
    onMove(fromId, toId) {
      const from = state.photos.findIndex((p) => p.id === fromId);
      const to = state.photos.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0) return;
      const [moved] = state.photos.splice(from, 1);
      state.photos.splice(to, 0, moved);
      renderGallery(); scheduleSave();
    },
  });

  $('edit-toggle').addEventListener('click', () => editor.toggle());
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'e' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName) || lightbox.isOpen) return;
    editor.toggle();
  });
  if (new URLSearchParams(location.search).has('edit')) editor.toggle(true);
}
