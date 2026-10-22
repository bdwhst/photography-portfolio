// 扫描 photos-src/<分类文件夹>/，为每张照片生成「可发布的缩小版」与缩略图，同步到 public/gallery.json
//   - 源图（jpg / png 等）只留在本机，不会发布；网站只用这里生成的缩小版
//   - 照片直接放在 photos-src/ 根目录即可，标签在网页编辑模式里点选（npm run dev 时）
//   - 也可以用子文件夹：文件夹名会作为自动标签加上，移出文件夹时摘掉；手工点选的标签不受影响
//   - 按文件内容去重：同一张图放进多个文件夹只生成一份、在「全部」里只出现一次，但会带上每个文件夹的分类
//   - 删除源文件后，对应分类标签会摘掉；所有副本都删掉才移除条目与生成图
//   - 已有条目的标题 / 说明 / 顺序 / span 不会被改动
//   - 输出尺寸 / 格式 / 水印 / 版权信息由 gallery.json 的 output 字段控制，改动后会自动重新生成
// 用法：npm run import            处理新增、删除与配置变动
//       npm run import -- --force  强制重新生成所有图片
// npm run dev / build 会自动调用（见 vite.config.js）
import sharp from 'sharp';
import { readdir, mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(ROOT, 'photos-src');
const FULL = path.join(ROOT, 'public/photos/full');
const THUMB = path.join(ROOT, 'public/photos/thumb');
export const DATA = path.join(ROOT, 'public/gallery.json');
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.avif']);

// 发布图的生成设置（可在 gallery.json 的 output 里覆盖）
export const DEFAULT_OUTPUT = {
  format: 'jpeg',          // jpeg | webp
  quality: 82,
  maxSize: 1600,           // 展示图长边 px，网站与灯箱都只用这个尺寸
  thumbSize: 800,          // 缩略图长边 px
  watermark: '© Han Yang', // 水印文字，留空则不加
  watermarkOpacity: 0.45,
  copyright: '© Han Yang', // 写入图片 EXIF 的版权信息
  artist: 'Han Yang',
};
const DEFAULT_DATA = () => ({
  site: {
    title: { zh: '杨焓', en: 'Han Yang' },
    subtitle: { zh: '摄影作品集', en: 'Photography' },
    about: { zh: '', en: '' },
    email: '', links: [],
    copyright: { zh: '© 2026 杨焓', en: '© 2026 Han Yang' },
  },
  layout: { mode: 'masonry', columns: 3, gap: 16, rowHeight: 320, radius: 0, maxWidth: 1400 },
  output: { ...DEFAULT_OUTPUT },
  protect: true,
  categories: {},
  photos: [],
});

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '') || 'photo';
const exists = (p) => stat(p).then(() => true, () => false);
const isImage = (f) => EXT.has(path.extname(f).toLowerCase()) && !f.startsWith('.');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fileHash = async (p) => createHash('sha1').update(await readFile(p)).digest('hex').slice(0, 16);
const categoryOf = (rel) => (rel.includes('/') ? rel.split('/')[0] : null);
const sourcesOf = (p) => p.sources || (p.source ? [p.source] : []);

async function scanSources() {
  const out = []; // { rel: 'landscape/a.jpg', category: 'landscape' | null }
  for (const e of (await readdir(SRC, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) {
      for (const f of (await readdir(path.join(SRC, e.name))).sort()) {
        if (isImage(f)) out.push({ rel: `${e.name}/${f}`, category: e.name });
      }
    } else if (isImage(e.name)) out.push({ rel: e.name, category: null });
  }
  return out;
}

// 右下角文字水印，字号随图片宽度缩放
function watermarkSvg(w, h, text, opacity) {
  const fs = Math.max(12, Math.round(w * 0.02));
  const pad = Math.round(fs * 1.2);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="${w - pad}" y="${h - pad}" text-anchor="end" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
      font-size="${fs}" letter-spacing="${(fs * 0.06).toFixed(1)}" fill="#000" fill-opacity="${(opacity * 0.5).toFixed(2)}"
      transform="translate(${Math.max(1, fs * 0.05)}, ${Math.max(1, fs * 0.05)})">${esc(text)}</text>
    <text x="${w - pad}" y="${h - pad}" text-anchor="end" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
      font-size="${fs}" letter-spacing="${(fs * 0.06).toFixed(1)}" fill="#fff" fill-opacity="${opacity}">${esc(text)}</text>
  </svg>`);
}

async function renderOne(input, outPath, size, out) {
  let img = input.clone().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true });
  if (out.format === 'jpeg') img = img.flatten({ background: '#ffffff' }); // PNG 透明底转白
  // 先缩放成像素，再叠水印，保证字号按最终尺寸计算
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  let final = sharp(data);
  if (out.watermark) {
    final = final.composite([{ input: watermarkSvg(info.width, info.height, out.watermark, out.watermarkOpacity) }]);
  }
  // 只写入版权信息；原图的 GPS、相机、拍摄参数等全部不保留
  const exif = {};
  if (out.copyright) exif.Copyright = out.copyright;
  if (out.artist) exif.Artist = out.artist;
  if (Object.keys(exif).length) final = final.withExif({ IFD0: exif });
  final = out.format === 'webp' ? final.webp({ quality: out.quality }) : final.jpeg({ quality: out.quality, mozjpeg: true });
  await final.toFile(outPath);
  return info;
}

export async function importPhotos({ force = false, log = console.log } = {}) {
  // 源图目录不存在（例如在没有源图的机器上打包）时，只创建目录，不做移除
  const hadSrc = await exists(SRC);
  if (!hadSrc) await mkdir(SRC, { recursive: true });
  await mkdir(FULL, { recursive: true });
  await mkdir(THUMB, { recursive: true });

  let data;
  try { data = { ...DEFAULT_DATA(), ...JSON.parse(await readFile(DATA, 'utf8')) }; }
  catch { data = DEFAULT_DATA(); }
  data.photos ??= [];
  data.categories ??= {};
  const out = { ...DEFAULT_OUTPUT, ...(data.output || {}) };
  if (!['jpeg', 'webp'].includes(out.format)) out.format = 'jpeg';
  const ext = out.format === 'webp' ? 'webp' : 'jpg';
  const outputHash = createHash('md5').update(JSON.stringify(out)).digest('hex').slice(0, 8);

  const sources = hadSrc ? await scanSources() : [];
  const ids = new Set(data.photos.map((p) => p.id));
  const byRel = new Map();
  for (const p of data.photos) {
    p.sources = sourcesOf(p); delete p.source; // 兼容旧格式
    for (const rel of p.sources) byRel.set(rel, p);
  }
  let added = 0, regenerated = 0, removed = 0, merged = 0;

  // 1) 按内容哈希认领新出现的路径：移动 / 改名的文件会回到原条目，内容相同的副本只是多挂一个分类
  const byHash = new Map();
  for (const p of data.photos) {
    if (!p.hash) { for (const rel of p.sources) { try { p.hash = await fileHash(path.join(SRC, rel)); break; } catch {} } }
    if (p.hash) byHash.set(p.hash, p);
  }
  for (const { rel, category } of sources) {
    if (byRel.has(rel)) continue;
    let hash;
    try { hash = await fileHash(path.join(SRC, rel)); } catch { continue; }
    const dup = byHash.get(hash);
    if (dup) {
      dup.sources.push(rel); byRel.set(rel, dup); merged++;
      log('合并重复', rel, '→', dup.id); continue;
    }
    const base = path.parse(rel).name;
    let id = slug(category ? `${category}-${base}` : base);
    let n = 2; const b = id; while (ids.has(id)) id = `${b}-${n++}`;
    const entry = { id, src: '', thumb: '', w: 0, h: 0, title: base, caption: '', tags: [], sources: [rel], hash };
    data.photos.push(entry); ids.add(id); byRel.set(rel, entry); byHash.set(hash, entry); added++;
  }

  // 2) 已不存在的路径 → 从条目里摘掉；副本全没了才移除条目与生成图
  if (hadSrc) {
    const live = new Set(sources.map((s) => s.rel));
    for (const p of [...data.photos]) {
      if (!p.sources.length) continue; // 没有源文件的条目（手工加的）不动
      const before = p.sources.length;
      p.sources = p.sources.filter((rel) => live.has(rel));
      if (p.sources.length) { if (p.sources.length < before) log('更新路径', p.id, '→', p.sources.join(', ')); continue; }
      data.photos.splice(data.photos.indexOf(p), 1);
      for (const f of [p.src, p.thumb]) if (f) await rm(path.join(ROOT, 'public', f), { force: true });
      removed++; log('移除', p.id);
    }
  }

  // 3) 分类标签：来自文件夹的自动标签每次按当前副本位置重算，手工加的标签保留
  for (const p of data.photos) {
    const auto = [...new Set(p.sources.map(categoryOf).filter(Boolean))];
    const manual = (p.tags || []).filter((t) => !(p.autoTags || []).includes(t));
    p.tags = [...new Set([...manual, ...auto])];
    if (auto.length) p.autoTags = auto; else delete p.autoTags;
    for (const c of auto) if (!data.categories[c]) data.categories[c] = { zh: c, en: c };
  }

  // 4) 生成 / 重新生成展示图
  for (const p of data.photos) {
    if (!p.sources.length) continue;
    const srcRel = `photos/full/${p.id}.${ext}`, thumbRel = `photos/thumb/${p.id}.${ext}`;
    const outFull = path.join(ROOT, 'public', srcRel), outThumb = path.join(ROOT, 'public', thumbRel);
    const isNew = !p.src;
    const needGen = force || isNew || p.outputHash !== outputHash || !(await exists(outFull)) || !(await exists(outThumb));
    if (!needGen) continue;

    let info;
    try {
      const input = sharp(path.join(SRC, p.sources[0])).rotate(); // 应用 EXIF 方向
      info = await renderOne(input, outFull, out.maxSize, out);
      await renderOne(input, outThumb, out.thumbSize, out);
    } catch (err) {
      log('跳过（无法读取）', p.sources[0], err.message);
      if (isNew) { data.photos.splice(data.photos.indexOf(p), 1); added--; }
      continue;
    }
    // 格式变化时清掉旧文件
    for (const f of [p.src, p.thumb]) if (f && f !== srcRel && f !== thumbRel) await rm(path.join(ROOT, 'public', f), { force: true });
    Object.assign(p, { src: srcRel, thumb: thumbRel, w: info.width, h: info.height, outputHash });
    if (isNew) log('新增', p.id, `${info.width}x${info.height}`); else { regenerated++; log('重新生成', p.id, `${info.width}x${info.height}`); }
  }

  // 固定字段顺序，便于阅读
  const ordered = { site: data.site, layout: data.layout, output: data.output || { ...DEFAULT_OUTPUT }, protect: data.protect ?? true,
                    categories: data.categories, photos: data.photos };
  await writeFile(DATA, JSON.stringify(ordered, null, 2) + '\n');
  return { added, regenerated, removed, merged, total: data.photos.length };
}

// 作为命令行直接运行
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await importPhotos({ force: process.argv.includes('--force') });
  console.log(`完成：新增 ${r.added}，合并重复 ${r.merged}，重新生成 ${r.regenerated}，移除 ${r.removed}，共 ${r.total} 张。标题 / 说明可在 public/gallery.json 里修改。`);
}
