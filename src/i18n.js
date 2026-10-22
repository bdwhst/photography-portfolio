// 界面文案与多语言取值
export const LANGS = ['zh', 'en'];

export const STRINGS = {
  zh: {
    work: '作品', about: '关于', all: '全部', edit: '编辑排布', editTitle: '排布编辑',
    masonry: '瀑布流', grid: '网格', justified: '等高行', column: '单列',
    columns: '列数', gap: '间距', rowHeight: '行高', radius: '圆角', maxWidth: '最大宽',
    hint: '拖拽照片可调整顺序，点击照片编辑它的标签。所有改动会自动保存到 public/gallery.json。',
    reset: '还原', resetDone: '已还原为文件中的内容', cleanTags: '清理未使用标签',
    saved: '已保存', saving: '保存中…', saveFail: '保存失败，请确认 npm run dev 正在运行',
    tags: '标签', addTag: '新标签', zhName: '中文名', enName: '英文名', add: '添加', span: '网格占位',
    empty: '暂无作品', close: '关闭', prev: '上一张', next: '下一张',
    theme: '切换主题', switchLang: 'EN', switchLangTitle: 'Switch to English',
    loadFail: '请把照片放进 photos-src/ 的分类文件夹，或运行 npm run samples', portfolio: '作品集',
  },
  en: {
    work: 'Work', about: 'About', all: 'All', edit: 'Edit layout', editTitle: 'LAYOUT',
    masonry: 'Masonry', grid: 'Grid', justified: 'Rows', column: 'Single',
    columns: 'Columns', gap: 'Gap', rowHeight: 'Row height', radius: 'Radius', maxWidth: 'Max width',
    hint: 'Drag photos to reorder, click a photo to edit its tags. Changes save to public/gallery.json automatically.',
    reset: 'Reset', resetDone: 'Reset to the saved file', cleanTags: 'Remove unused tags',
    saved: 'Saved', saving: 'Saving…', saveFail: 'Save failed. Is npm run dev running?',
    tags: 'Tags', addTag: 'New tag', zhName: 'Chinese', enName: 'English', add: 'Add', span: 'Grid size',
    empty: 'No photos yet', close: 'Close', prev: 'Previous', next: 'Next',
    theme: 'Toggle theme', switchLang: '中文', switchLangTitle: '切换到中文',
    loadFail: 'Drop photos into the category folders in photos-src/, or run npm run samples', portfolio: 'Portfolio',
  },
};

let current = 'zh';

export function detectLang() {
  try { const saved = localStorage.getItem('lang'); if (LANGS.includes(saved)) return saved; } catch {}
  return /^zh/i.test(navigator.language) ? 'zh' : 'en';
}
export function getLang() { return current; }
export function setLang(l) {
  current = LANGS.includes(l) ? l : 'zh';
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
  try { localStorage.setItem('lang', current); } catch {}
}
// 界面文案
export const ui = (key) => STRINGS[current][key] ?? STRINGS.zh[key] ?? key;
// 数据字段：字符串原样返回；{zh, en} 对象按当前语言取值，缺失则回退
export function tr(v) {
  if (v == null) return '';
  if (typeof v !== 'object') return String(v);
  return v[current] ?? v.zh ?? v.en ?? Object.values(v)[0] ?? '';
}
